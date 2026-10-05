"""SKILL_AWARE_HYBRID — the student-designed improvement.

    hybrid = sum_i w_i * f_i / sum_i w_i    over the components f_i that are AVAILABLE for the pair

Components (all in [0, 1]):
  semantic_similarity        BGE cosine of the whole resume and job (Phase 4), min-max scaled
  required_skill_coverage    share of the job's required skills found in the resume
  preferred_skill_coverage   share of the job's preferred skills found in the resume
  experience_match           candidate years / required years, capped at 1
  responsibility_similarity  each job duty matched to the closest resume experience sentence, averaged (scaled)

A component is unavailable when there is nothing to measure: the job lists no required (or
preferred) skills, states no years requirement, or the resume's experience cannot be estimated.
Missing information is then left out (the other weights are renormalised) instead of being
counted as a zero. Weights and scaling bounds are chosen on the validation split only
(ml/evaluation/hybrid_select.py) and frozen in config/matching_weights.json.
"""
import numpy as np
import pandas as pd

from ml.features.education import education_match, job_education, resume_education
from ml.features.experience import experience_match, job_experience, resume_experience
from ml.features.responsibilities import alignment, candidate_evidence, job_responsibilities
from ml.features.skills import default_extractor, skill_coverage
from ml.models.semantic import SemanticMatcher
from ml.models.text import normalize

MODEL_NAME = "hybrid"
COMPONENTS = ["semantic_similarity", "required_skill_coverage", "preferred_skill_coverage",
              "experience_match", "responsibility_similarity"]
SCALED = ["semantic_similarity", "responsibility_similarity"]  # cosines live in a narrow band
AVAILABLE_IF = {"required_skill_coverage": "required_skill_count", "preferred_skill_coverage": "preferred_skill_count"}

FEATURE_SCHEMA = {  # name: (range, meaning); every column written to the prediction files
    "semantic_similarity": ("[-1,1] raw", "BGE cosine of resume and job (first 512 tokens)"),
    "required_skill_coverage": ("[0,1]", "matched required skills / required skills (0 if none detected)"),
    "preferred_skill_coverage": ("[0,1]", "matched preferred skills / preferred skills (0 if none detected)"),
    "weighted_skill_coverage": ("[0,1]", "(req matches + alpha*pref matches) / (req + alpha*pref); diagnostic"),
    "job_skill_coverage": ("[0,1]", "share of ALL detected job skills (incl. uncertain) in resume; diagnostic"),
    "required_skill_count": ("int", "required skills detected in the job"),
    "preferred_skill_count": ("int", "preferred skills detected in the job"),
    "uncertain_skill_count": ("int", "job skills with no required/preferred signal"),
    "missing_required_skill_count": ("int", "required skills not found in the resume"),
    "missing_preferred_skill_count": ("int", "preferred skills not found in the resume"),
    "experience_match": ("[0,1] or empty", "min(1, candidate years / required years); empty if unknown"),
    "candidate_experience_years": ("years or empty", "merged employment date ranges (or stated years)"),
    "required_experience_years": ("years or empty", "strictest minimum years stated in the job"),
    "experience_gap": ("years or empty", "max(0, required - candidate)"),
    "education_match": ("[0,1] or empty", "1 meets level, 0.5 one level below, 0 lower; diagnostic"),
    "responsibility_similarity": ("[-1,1] raw or empty", "mean best BGE cosine of job duties vs experience sentences"),
    "responsibilities_from_section": ("bool", "job duties came from a responsibilities section"),
}


def combine(features: pd.DataFrame, weights: dict, scaler: dict) -> np.ndarray:
    """Weighted average of the available, scaled components. Pure function of its inputs."""
    num = np.zeros(len(features))
    den = np.zeros(len(features))
    for name, w in weights.items():
        x = features[name].to_numpy(dtype=float)
        if name in scaler:
            lo, hi = scaler[name]
            x = np.clip((x - lo) / (hi - lo), 0.0, 1.0)
        available = ~np.isnan(x)
        if name in AVAILABLE_IF:
            available &= features[AVAILABLE_IF[name]].to_numpy() > 0
        num += w * np.where(available, x, 0.0)
        den += w * available
    return np.where(den > 0, num / np.where(den > 0, den, 1.0), 0.0)


def fit_scaler(features: pd.DataFrame, low=1, high=99) -> dict:
    """Min-max bounds (1st / 99th percentile) for the cosine features. Call on VALIDATION only."""
    out = {}
    for name in SCALED:
        x = features[name].dropna().to_numpy()
        out[name] = [float(np.percentile(x, low)), float(np.percentile(x, high))]
    return out


class HybridMatcher:
    def __init__(self, semantic: SemanticMatcher, weights: dict | None = None, scaler: dict | None = None,
                 alpha: float = 0.5, extractor=None):
        self.semantic, self.weights, self.scaler, self.alpha = semantic, weights, scaler or {}, alpha
        self.extractor = extractor or default_extractor()
        self._jobs, self._resumes = {}, {}

    def fit(self, texts=None):
        """Nothing is learned from train: weights/scaler come from validation selection."""
        return self

    # ---------- parsing (cached per distinct text) ----------

    def parse_job(self, text: str) -> dict:
        t = normalize(text)
        if t not in self._jobs:
            duties, from_section = job_responsibilities(t)
            self._jobs[t] = {"skills": self.extractor.job_skills(t), "experience": job_experience(t),
                             "education": job_education(t), "responsibilities": duties,
                             "responsibilities_from_section": from_section}
        return self._jobs[t]

    def parse_resume(self, text: str) -> dict:
        t = normalize(text)
        if t not in self._resumes:
            self._resumes[t] = {"skills": self.extractor.resume_skills(t), "experience": resume_experience(t),
                                "education": resume_education(t), "evidence": candidate_evidence(t)}
        return self._resumes[t]

    # ---------- features ----------

    def _pair(self, job: dict, resume: dict, vec: dict) -> tuple[dict, list]:
        cov = skill_coverage(job["skills"], resume["skills"], self.alpha)
        cand = resume["experience"]["total_years"]
        req = job["experience"]["required_min_years"]
        resp, best = alignment(_stack(job["responsibilities"], vec), _stack(resume["evidence"], vec))
        exp = experience_match(cand, req)
        edu = education_match(resume["education"]["highest_level"], job["education"]["required_level"])
        row = {k: v for k, v in cov.items() if not isinstance(v, list)}
        row |= {"experience_match": np.nan if exp is None else exp,
                "candidate_experience_years": np.nan if cand is None else cand,
                "required_experience_years": np.nan if req is None else req,
                "experience_gap": np.nan if cand is None or req is None else max(0.0, req - cand),
                "education_match": np.nan if edu is None else edu,
                "responsibility_similarity": np.nan if resp is None else resp,
                "responsibilities_from_section": job["responsibilities_from_section"]}
        return row, best

    def features(self, resumes, jobs) -> pd.DataFrame:
        """One row of label-free features per (resume, job) pair."""
        resumes, jobs = list(resumes), list(jobs)
        parsed_j = [self.parse_job(j) for j in jobs]
        parsed_r = [self.parse_resume(r) for r in resumes]
        sentences = sorted({s for p in parsed_j for s in p["responsibilities"]} |
                           {s for p in parsed_r for s in p["evidence"]})
        vec = dict(zip(sentences, self.semantic.encode(sentences))) if sentences else {}
        rows = [self._pair(j, r, vec)[0] for j, r in zip(parsed_j, parsed_r)]
        out = pd.DataFrame(rows)
        out.insert(0, "semantic_similarity", self.semantic.score_pairs(resumes, jobs))
        return out

    def pair_features(self, resumes, jobs) -> pd.DataFrame:
        feats = self.features(resumes, jobs)
        feats.insert(0, "score", combine(feats, self.weights, self.scaler))
        return feats

    def score_pairs(self, resumes, jobs) -> np.ndarray:
        return self.pair_features(resumes, jobs)["score"].to_numpy()

    # ---------- explanation ----------

    def explain(self, resume: str, job: str) -> dict:
        """Why did this candidate get this score? Built only from extracted values and evidence."""
        j, r = self.parse_job(job), self.parse_resume(resume)
        sentences = sorted(set(j["responsibilities"]) | set(r["evidence"]))
        vec = dict(zip(sentences, self.semantic.encode(sentences))) if sentences else {}
        row, best = self._pair(j, r, vec)
        feats = pd.DataFrame([{"semantic_similarity": self.semantic.score_pairs([resume], [job])[0], **row}])
        score = float(combine(feats, self.weights, self.scaler)[0])
        cov = skill_coverage(j["skills"], r["skills"], self.alpha)
        f = feats.iloc[0]
        scaled = {n: (float(np.clip((f[n] - lo) / (hi - lo), 0, 1)) if not np.isnan(f[n]) else None)
                  for n, (lo, hi) in self.scaler.items()}
        used = [n for n in self.weights
                if not np.isnan(f[n]) and (n not in AVAILABLE_IF or f[AVAILABLE_IF[n]] > 0)]
        return {
            "model": MODEL_NAME,
            "overall_score": score,
            "components": {
                "semantic_score": scaled.get("semantic_similarity"),
                "required_skill_coverage": cov["required_skill_coverage"] if cov["required_skill_count"] else None,
                "preferred_skill_coverage": cov["preferred_skill_coverage"] if cov["preferred_skill_count"] else None,
                "experience_match": None if np.isnan(f["experience_match"]) else float(f["experience_match"]),
                "responsibility_similarity": scaled.get("responsibility_similarity"),
            },
            "components_used": used,
            "weights": self.weights,
            "matched_required_skills": cov["matched_required_skills"],
            "missing_required_skills": cov["missing_required_skills"],
            "matched_preferred_skills": cov["matched_preferred_skills"],
            "missing_preferred_skills": cov["missing_preferred_skills"],
            "uncertain_job_skills": cov["uncertain_skills"],
            "skill_evidence": {s: r["skills"][s] for s in cov["matched_required_skills"] + cov["matched_preferred_skills"]},
            "requirement_evidence": {s: j["skills"][s]["evidence"] for s in j["skills"]
                                     if j["skills"][s]["status"] != "uncertain"},
            "experience": {"candidate_years": r["experience"]["total_years"], "source": r["experience"]["source"],
                           "required_years": j["experience"]["required_min_years"],
                           "gap_years": None if np.isnan(f["experience_gap"]) else float(f["experience_gap"]),
                           "requirement_evidence": j["experience"]["evidence"]},
            "education": {"candidate_level": r["education"]["highest_level"],
                          "required_level": j["education"]["required_level"]},
            "responsibility_evidence": [{"job_responsibility": j["responsibilities"][a],
                                         "candidate_experience": r["evidence"][b], "similarity": round(s, 4)}
                                        for a, b, s in best],
            **_narrative(cov, f, scaled),
        }


def _stack(sentences: list[str], vec: dict) -> np.ndarray:
    return np.array([vec[s] for s in sentences]) if sentences else np.empty((0, 0))


def _narrative(cov: dict, f, scaled: dict) -> dict:
    """Template sentences from feature values only (no LLM)."""
    strengths, gaps = [], []
    if cov["required_skill_count"]:
        m, n = len(cov["matched_required_skills"]), cov["required_skill_count"]
        line = f"{m} of {n} required skills found"
        (strengths if m / n >= 0.75 else gaps).append(
            line + (f": {', '.join(cov['matched_required_skills'])}" if m / n >= 0.75 else
                    f"; missing: {', '.join(cov['missing_required_skills'])}"))
    else:
        gaps.append("No required skills were detected in the job description, so skill coverage was not scored")
    if cov["matched_preferred_skills"]:
        strengths.append(f"Preferred skills found: {', '.join(cov['matched_preferred_skills'])}")
    if not np.isnan(f["experience_match"]):
        if f["experience_match"] >= 1:
            strengths.append(f"Meets the experience requirement ({f['candidate_experience_years']:.1f} vs "
                             f"{f['required_experience_years']:.0f} years)")
        else:
            gaps.append(f"Estimated experience {f['candidate_experience_years']:.1f} years is below the "
                        f"{f['required_experience_years']:.0f} years requested")
    for name, label in [("semantic_similarity", "overall profile"), ("responsibility_similarity", "past duties")]:
        v = scaled.get(name)
        if v is not None:
            (strengths if v >= 0.66 else gaps if v < 0.33 else []).append(
                f"{'Strong' if v >= 0.66 else 'Weak'} similarity between the {label} and the job")
    return {"strengths": strengths, "gaps": gaps}
