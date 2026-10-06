"""Structured error analysis on the original test split (saved Phase 3-5 predictions).

    python -m ml.evaluation.error_analysis   -> results/error_analysis.csv, error_analysis_summary.csv

Unit: each test job with at least one relevant (label > 0) and one non-relevant candidate.
A model SUCCEEDS on a job if its top-ranked candidate is relevant (P@1 = 1); ties are broken by
resume_id, exactly as in the metric code.

Categories (a job can be in several):
  A  TF-IDF succeeds, BGE fails        B  BGE succeeds, TF-IDF fails
  C  Hybrid succeeds, BGE fails        D  BGE succeeds, Hybrid fails
  E  all three fail
Selection rule for examples, fixed in advance and independent of which model wins: the first
3 jobs of each category in job_id order. Every job in a category gets rule-based tags (below),
computed only from structured features. No resume or job text is written.
"""
import numpy as np
import pandas as pd

from ml.config import RESULTS_DIR

MODELS = {"tfidf": "tfidf_score", "semantic": "semantic_score", "hybrid": "hybrid_score"}
CATEGORIES = {
    "A_tfidf_ok_bge_fails": lambda s: s["tfidf"] and not s["semantic"],
    "B_bge_ok_tfidf_fails": lambda s: s["semantic"] and not s["tfidf"],
    "C_hybrid_ok_bge_fails": lambda s: s["hybrid"] and not s["semantic"],
    "D_bge_ok_hybrid_fails": lambda s: s["semantic"] and not s["hybrid"],
    "E_all_fail": lambda s: not (s["tfidf"] or s["semantic"] or s["hybrid"]),
}
EXAMPLES_PER_CATEGORY = 3
TAGS = ["missing_required_skill", "semantic_similarity_despite_missing_requirement", "responsibility_mismatch",
        "terminology_mismatch", "experience_mismatch", "generic_job_boilerplate",
        "insufficient_requirement_or_candidate_evidence"]
FEATURES = ["semantic_similarity", "required_skill_count", "required_skill_coverage", "missing_required_skill_count",
            "experience_match", "experience_gap", "responsibility_similarity", "responsibilities_from_section"]


def load() -> pd.DataFrame:
    hyb = pd.read_csv(RESULTS_DIR / "hybrid_test_predictions.csv")
    for name in ("tfidf", "semantic"):
        other = pd.read_csv(RESULTS_DIR / f"{name}_test_predictions.csv")[["resume_id", "job_id", MODELS[name]]]
        hyb = hyb.merge(other, on=["resume_id", "job_id"], validate="one_to_one")
    return hyb


def top(g: pd.DataFrame, col: str) -> pd.Series:
    return g.sort_values([col, "resume_id"], ascending=[False, True], kind="mergesort").iloc[0]


def tags(g: pd.DataFrame, wrong: pd.Series | None) -> list[str]:
    """Rule-based diagnostics. `wrong` = the non-relevant candidate a failing model ranked first."""
    rel = g[g.label_id > 0]
    out = []
    if wrong is not None:
        if wrong.missing_required_skill_count > 0:
            out.append("missing_required_skill")
            if wrong.semantic_similarity >= g.semantic_similarity.median():
                out.append("semantic_similarity_despite_missing_requirement")
        if rel.responsibility_similarity.mean() < wrong.responsibility_similarity:
            out.append("responsibility_mismatch")
    n = len(g)
    lex = g.tfidf_score.rank(ascending=False)
    sem = g.semantic_score.rank(ascending=False)
    if ((sem[rel.index] - lex[rel.index]).abs() >= n / 2).any():
        out.append("terminology_mismatch")          # a relevant candidate ranked far apart lexically vs semantically
    if (rel.experience_gap > 0).any():
        out.append("experience_mismatch")
    if not g.responsibilities_from_section.iloc[0]:
        out.append("generic_job_boilerplate")       # no duties section: duties taken from the whole ad
    if g.required_skill_count.iloc[0] == 0 or rel.experience_match.isna().all():
        out.append("insufficient_requirement_or_candidate_evidence")
    return out


def analyse(df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for job_id, g in df.groupby("job_id", sort=True):
        binary = (g.label_id > 0).astype(int)
        if not 0 < binary.sum() < len(g):
            continue
        tops = {m: top(g, c) for m, c in MODELS.items()}
        success = {m: bool(t.label_id > 0) for m, t in tops.items()}
        for cat, rule in CATEGORIES.items():
            if not rule(success):
                continue
            failing = "semantic" if cat[0] in "AC" else "tfidf" if cat[0] == "B" else "hybrid"
            wrong = tops[failing] if not success[failing] else None
            row = {"category": cat, "job_id": job_id, "n_candidates": len(g), "n_relevant": int(binary.sum()),
                   **{f"{m}_top_resume_id": t.resume_id for m, t in tops.items()},
                   **{f"{m}_top_label": t.label for m, t in tops.items()},
                   "failing_model": failing,
                   **{f"wrong_top_{f}": (wrong[f] if wrong is not None else np.nan) for f in FEATURES},
                   "relevant_mean_required_coverage": g[g.label_id > 0].required_skill_coverage.mean(),
                   "relevant_mean_semantic": g[g.label_id > 0].semantic_similarity.mean(),
                   **{f"tag_{t}": t in tags(g, wrong) for t in TAGS}}
            rows.append(row)
    out = pd.DataFrame(rows).sort_values(["category", "job_id"], kind="mergesort").reset_index(drop=True)
    out["example"] = out.groupby("category").cumcount() < EXAMPLES_PER_CATEGORY
    return out


def summarise(out: pd.DataFrame, n_jobs: int) -> pd.DataFrame:
    rows = []
    for cat, g in out.groupby("category"):
        rows.append({"category": cat, "jobs": len(g), "share_of_binary_eligible_jobs": round(len(g) / n_jobs, 4),
                     **{f"tag_{t}": int(g[f"tag_{t}"].sum()) for t in TAGS}})
    return pd.DataFrame(rows)


def main():
    df = load()
    n_jobs = sum(0 < (g.label_id > 0).sum() < len(g) for _, g in df.groupby("job_id"))
    out = analyse(df)
    out.round(6).to_csv(RESULTS_DIR / "error_analysis.csv", index=False)
    summary = summarise(out, n_jobs)
    summary.to_csv(RESULTS_DIR / "error_analysis_summary.csv", index=False)
    with pd.option_context("display.width", 250, "display.max_columns", 30):
        print(f"binary-eligible test jobs: {n_jobs}")
        print(summary.to_string(index=False))
        ex = out[out.example].copy()
        ex["tags"] = ex[[f"tag_{t}" for t in TAGS]].apply(lambda r: ",".join(t for t in TAGS if r[f"tag_{t}"]), axis=1)
        print(ex[["category", "job_id", "n_candidates", "failing_model", "tags"]].to_string(index=False))


if __name__ == "__main__":
    main()
