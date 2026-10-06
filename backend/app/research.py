"""Read-only access to the committed research results (Phases 2-6). Nothing is recomputed."""
import json
from functools import lru_cache

import pandas as pd

from ml.config import RESULTS_DIR

LIMITATIONS = [
    "Small dataset: 643 unique resumes and 351 unique jobs from one public dataset with undocumented labelling.",
    "The hybrid's ranking gain over BGE is consistent across 5 grouped splits but small (about +0.01 NDCG@10).",
    "Required-skill coverage improves explanations but not ranking; the best hybrid weighting varies by split.",
    "Classification (Strong / Potential / Weak) is secondary and not consistently improved by the hybrid.",
    "Extraction is rule-based: a fixed 178-skill taxonomy, approximate experience dates, no soft skills.",
    "Scores are similarities, not probabilities, and must not be the sole basis for hiring decisions.",
]


def _records(df: pd.DataFrame) -> list[dict]:
    return json.loads(df.to_json(orient="records"))


@lru_cache(maxsize=None)
def _csv(name: str) -> pd.DataFrame:
    return pd.read_csv(RESULTS_DIR / name)


@lru_cache(maxsize=None)
def _json(name: str) -> dict:
    return json.loads((RESULTS_DIR / name).read_text())


def models() -> dict:
    df = _csv("final_model_comparison.csv")
    return {"source": "results/final_model_comparison.csv", "rows": _records(df),
            "primary_metrics": ["ndcg@10", "ndcg@5", "mrr", "map", "p@1", "p@5"],
            "secondary_metrics": ["accuracy", "macro_precision", "macro_recall", "macro_f1"]}


def ablation() -> dict:
    return {"source": "results/final_ablation.csv", "rows": _records(_csv("final_ablation.csv")),
            "note": "Components are not individually guaranteed to improve ranking; effects vary across splits."}


def robustness() -> dict:
    return {"source": "results/repeated_grouped_*.csv",
            "summary": _records(_csv("repeated_grouped_summary.csv")),
            "differences": _records(_csv("repeated_grouped_differences.csv")),
            "per_repetition": _records(_csv("repeated_grouped_per_rep.csv")),
            "selection": _records(_csv("repeated_grouped_selection.csv")),
            "design": _json("repeated_grouped_meta.json")}


def summary() -> dict:
    stats = _json("dataset_stats.json")
    comp = _csv("final_model_comparison.csv").set_index("model")
    diff = _csv("repeated_grouped_differences.csv")
    hb = diff[(diff.comparison == "hybrid - semantic") & (diff.metric == "ndcg@10")].iloc[0]
    headline = {m: {"test_ndcg@10": comp.loc[m, "test_ndcg@10"], "test_mrr": comp.loc[m, "test_mrr"],
                    "repeated_mean_ndcg@10": comp.loc[m, "repeated_mean_ndcg@10"] if
                    pd.notna(comp.loc[m].get("repeated_mean_ndcg@10")) else None}
                for m in comp.index}
    return {
        "dataset": {"name": "Resume-Job Description Fit (cnamuangtoun/resume-job-description-fit)",
                    "pairs": stats["total_examples"], "unique_resumes": stats["unique_resumes"],
                    "unique_jobs": stats["unique_jobs"],
                    "splits": {k: v["rows"] for k, v in stats["splits"].items()},
                    "no_resume_overlap_between_splits": stats["no_resume_overlap"]},
        "models": 3, "student_innovation": "Skill-Aware Hybrid",
        "headline": headline,
        "hybrid_vs_semantic_repeated": {"mean_ndcg@10_diff": hb.mean_diff, "ci95": [hb.ci95_low, hb.ci95_high],
                                        "splits_positive": int(hb.reps_positive), "splits": int(hb.n_repetitions)},
        "explainability_check": _json("hybrid_explainability_check.json"),
        "limitations": LIMITATIONS,
        "details": "docs/evaluation.md",
    }
