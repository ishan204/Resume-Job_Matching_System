"""Read-only access to the committed research results (Phases 2-6). Nothing is recomputed."""
import json
from functools import lru_cache

import pandas as pd

from ml.config import RESULTS_DIR

LIMITATIONS = [
    "Only one primary dataset (Resume-Job Description Fit); its labelling process is undocumented.",
    "Small scale: 643 unique resumes and 351 unique jobs.",
    "Ranking gains are small: the hybrid beats BGE by about +0.01 NDCG@10 on average across repeated splits.",
    "Classification (macro F1) does not improve on average: BGE has the highest repeated-split macro F1.",
    "Required-skill coverage does not improve ranking in any analysis; its value is in the explanation.",
    "Extraction errors remain possible: rule-based parsing, a fixed 178-skill taxonomy, no soft skills.",
    "Experience years are approximate estimates from employment date ranges.",
    "Results may not generalise beyond this dataset.",
    "Scores are model scores, not probabilities, and must not be the sole basis for hiring decisions.",
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
    def val(m, col):
        v = comp.loc[m].get(col)
        return None if pd.isna(v) else float(v)
    headline = {m: {"test_ndcg@10": val(m, "test_ndcg@10"), "test_mrr": val(m, "test_mrr"),
                    "repeated_mean_ndcg@10": val(m, "repeated_mean_ndcg@10"),
                    "repeated_mean_macro_f1": val(m, "repeated_mean_macro_f1")}
                for m in comp.index}
    design = _json("repeated_grouped_meta.json")
    return {
        "dataset": {"name": "Resume-Job Description Fit (cnamuangtoun/resume-job-description-fit)",
                    "raw_pairs": stats["prepare"]["raw_rows"], "pairs": stats["total_examples"],
                    "label_counts": stats["prepare"]["label_counts"],
                    "removed": {"exact_duplicates": stats["prepare"]["dropped_exact_duplicates"],
                                "conflicting_label_pairs": stats["prepare"]["dropped_conflicting_pairs"],
                                "empty": stats["prepare"]["dropped_empty"]},
                    "unique_resumes": stats["unique_resumes"],
                    "unique_jobs": stats["unique_jobs"],
                    "splits": {k: v["rows"] for k, v in stats["splits"].items()},
                    "no_resume_overlap_between_splits": stats["no_resume_overlap"],
                    "original_split_leakage": _json("original_split_leakage.json")},
        "repeated_evaluation": {"repetitions": len(design["repetitions"]),
                                "all_leakage_free": design["all_repetitions_leakage_free"],
                                "test_jobs_eligible": sum(r["test_jobs_eligible"] for r in design["repetitions"])},
        "models": 3, "student_innovation": "Skill-Aware Hybrid",
        "headline": headline,
        "hybrid_vs_semantic_repeated": {"mean_ndcg@10_diff": hb.mean_diff, "ci95": [hb.ci95_low, hb.ci95_high],
                                        "splits_positive": int(hb.reps_positive), "splits": int(hb.n_repetitions)},
        "explainability_check": _json("hybrid_explainability_check.json"),
        "limitations": LIMITATIONS,
        "details": "docs/evaluation.md",
    }
