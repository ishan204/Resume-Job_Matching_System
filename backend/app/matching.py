"""Run one model (or all three) on a single resume/job pair and shape the response."""
import numpy as np

from backend.app.config import DISCLAIMER, MODELS
from backend.app.registry import Registry

CATEGORIES = ("Weak match", "Potential match", "Strong match")  # No / Potential / Good Fit thresholds


def _base(reg: Registry, model: str, score: float) -> dict:
    t1, t2 = reg.thresholds[model]
    return {"model": model, "score": round(float(score), 6),
            "category": CATEGORIES[int(np.digitize(score, [t1, t2]))],
            "thresholds": [round(t1, 6), round(t2, 6)],
            "validation_percentile": reg.percentile(model, score), "disclaimer": DISCLAIMER}


def _tfidf(reg: Registry, resume: str, job: str) -> dict:
    m = reg.tfidf()
    R, J = m.transform([resume]), m.transform([job])
    score = float(R.multiply(J).sum())
    contrib = R.multiply(J).tocsr()
    terms = getattr(reg, "_tfidf_terms", None)
    if terms is None:
        terms = reg._tfidf_terms = m.vectorizer.get_feature_names_out()
    top = sorted(zip(contrib.indices, contrib.data), key=lambda x: -x[1])[:10]
    return {**_base(reg, "tfidf", score), "components": {"tfidf_similarity": round(score, 6)},
            "explanation": {
                "summary": "Cosine similarity of TF-IDF word vectors: how much rare vocabulary the two texts share.",
                "top_shared_terms": [{"term": str(terms[i]), "contribution": round(float(v), 6)} for i, v in top],
                "limitations": "Lexical only: synonyms and paraphrases do not count, and it cannot tell "
                               "required from optional skills."}}


def _semantic(reg: Registry, resume: str, job: str) -> dict:
    score = float(reg.semantic().score_pairs([resume], [job])[0])
    return {**_base(reg, "semantic", score), "components": {"semantic_similarity": round(score, 6)},
            "explanation": {
                "summary": "Cosine similarity of BGE (bge-base-en-v1.5) embeddings of the first 512 tokens "
                           "of each text: how related the overall topics are.",
                "limitations": "One vector per document: there is no feature-level evidence of which "
                               "requirements are met. BGE scores fall in a narrow band, so read the "
                               "category / percentile rather than the raw value."}}


def _hybrid(reg: Registry, resume: str, job: str) -> dict:
    ex = reg.hybrid().explain(resume, job)
    c = ex["components"]
    return {**_base(reg, "hybrid", ex["overall_score"]),
            "components": c,
            "matched_required_skills": ex["matched_required_skills"],
            "missing_required_skills": ex["missing_required_skills"],
            "matched_preferred_skills": ex["matched_preferred_skills"],
            "missing_preferred_skills": ex["missing_preferred_skills"],
            "experience": ex["experience"],
            "responsibility_similarity": c["responsibility_similarity"],
            "explanation": {
                "summary": "Weighted average of the available components (semantic similarity, required and "
                           "preferred skill coverage, experience match, responsibility alignment); components "
                           "with nothing to measure are left out.",
                "weights": ex["weights"], "components_used": ex["components_used"],
                "strengths": ex["strengths"], "gaps": ex["gaps"],
                "uncertain_job_skills": ex["uncertain_job_skills"],
                "skill_evidence": ex["skill_evidence"],
                "requirement_evidence": ex["requirement_evidence"],
                "responsibility_evidence": ex["responsibility_evidence"],
                "education": ex["education"]}}


RUNNERS = {"tfidf": _tfidf, "semantic": _semantic, "hybrid": _hybrid}


def match(reg: Registry, model: str, resume: str, job: str) -> dict:
    return RUNNERS[model](reg, resume, job)


def compare(reg: Registry, resume: str, job: str) -> dict:
    results = {m: match(reg, m, resume, job) for m in MODELS}
    ranking = sorted(({"model": m, "score": r["score"], "category": r["category"],
                       "validation_percentile": r["validation_percentile"]} for m, r in results.items()),
                     key=lambda x: (-x["validation_percentile"], x["model"]))
    return {**results, "ranking": ranking, "disclaimer": DISCLAIMER,
            "note": "These are model scores on different scales, not calibrated probabilities. Models are "
                    "ranked by validation percentile: the share of the model's own validation pairs that "
                    "scored lower."}
