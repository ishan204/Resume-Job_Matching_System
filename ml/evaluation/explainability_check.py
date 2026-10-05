"""Do the hybrid's explanations tell the truth about its own features? (Phase 6)

    python -m ml.evaluation.explainability_check [config]   -> results/explainability_check.json

For every test pair, the explanation of the frozen hybrid (default: the Phase 5 model) is checked
against independently recomputed facts:
  1 reported missing required/preferred skills are NOT in the resume (fresh skill extraction)
  2 reported matched skills ARE in the resume and ARE required/preferred in the job
  3 matched + missing = exactly the job's required (preferred) skills
  4 experience gap = max(0, required years - candidate years), using the parsed values
  5 responsibility evidence: the candidate sentence occurs in the resume, the duty in the job
  6 skill evidence sentences occur in the resume text
  7 the overall score equals sum(w * component) / sum(w) over the components marked as used
  8 the overall score equals the score saved in the test prediction file
Counts of passing pairs are written; nothing about the text itself is stored.
"""
import json
import sys

import numpy as np
import pandas as pd

from ml.config import DATA_SPLITS, EXPERIMENTS_DIR, RESULTS_DIR
from ml.evaluation.experiment import build_hybrid
from ml.models.text import normalize

CHECKS = ["missing_absent", "matched_present", "matched_plus_missing_complete", "experience_gap",
          "responsibility_evidence_in_text", "skill_evidence_in_text", "score_recomposes", "score_matches_saved"]


def check_pair(m, resume: str, job: str, saved_score: float) -> dict[str, bool]:
    ex = m.explain(resume, job)
    r_text, j_text = normalize(resume), normalize(job)
    resume_skills = set(m.extractor.resume_skills(r_text))
    job_skills = m.extractor.job_skills(j_text, m.glued_cues)
    req = {s for s, v in job_skills.items() if v["status"] == "required"}
    pref = {s for s, v in job_skills.items() if v["status"] == "preferred"}
    missing = set(ex["missing_required_skills"]) | set(ex["missing_preferred_skills"])
    matched_r, matched_p = set(ex["matched_required_skills"]), set(ex["matched_preferred_skills"])

    e = ex["experience"]
    if e["candidate_years"] is None or e["required_years"] is None:
        gap_ok = e["gap_years"] is None
    else:
        gap_ok = np.isclose(e["gap_years"], max(0.0, e["required_years"] - e["candidate_years"]))

    comps, w = ex["components"], ex["weights"]
    used = ex["components_used"]
    recomposed = sum(w[c] * comps[_component_key(c)] for c in used) / sum(w[c] for c in used) if used else 0.0

    return {
        "missing_absent": not (missing & resume_skills),
        "matched_present": matched_r <= resume_skills and matched_p <= resume_skills
                           and matched_r <= req and matched_p <= pref,
        "matched_plus_missing_complete": (matched_r | set(ex["missing_required_skills"])) == req
                                         and (matched_p | set(ex["missing_preferred_skills"])) == pref,
        "experience_gap": bool(gap_ok),
        "responsibility_evidence_in_text": all(ev["candidate_experience"] in r_text and ev["job_responsibility"] in j_text
                                               for ev in ex["responsibility_evidence"]),
        "skill_evidence_in_text": all(sentence in r_text for sentence in ex["skill_evidence"].values()),
        "score_recomposes": bool(np.isclose(recomposed, ex["overall_score"], atol=1e-9)),
        "score_matches_saved": bool(np.isclose(ex["overall_score"], saved_score, atol=1e-9)),
    }


def _component_key(name: str) -> str:
    return "semantic_score" if name == "semantic_similarity" else name


def main(config: str = "hybrid"):
    params = json.loads((EXPERIMENTS_DIR / f"{config}.json").read_text())
    m = build_hybrid(None, params)
    test = pd.read_csv(DATA_SPLITS / "test.csv", keep_default_na=False)
    saved = pd.read_csv(RESULTS_DIR / f"{config}_test_predictions.csv").set_index(["resume_id", "job_id"])["hybrid_score"]
    results = [check_pair(m, r.resume, r.job_description, saved[(r.resume_id, r.job_id)])
               for r in test.itertuples()]
    df = pd.DataFrame(results)
    summary = {"config": config, "pairs_checked": len(df),
               "passed": {c: int(df[c].sum()) for c in CHECKS},
               "all_checks_pass_for_all_pairs": bool(df.all().all())}
    (RESULTS_DIR / f"{config}_explainability_check.json").write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary, indent=2))
    if not summary["all_checks_pass_for_all_pairs"]:
        raise SystemExit("EXPLAINABILITY CHECK: FAIL")
    print("EXPLAINABILITY CHECK: PASS")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "hybrid")
