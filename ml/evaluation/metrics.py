"""Ranking and classification metrics shared by every model.

Relevance (from the dataset label):
  graded  : No Fit = 0, Potential Fit = 1, Good Fit = 2          -> used by NDCG
  binary  : relevant = label > 0 (Potential Fit or Good Fit)     -> used by MRR, MAP, P@k

Ranking unit = one job and its candidate resumes in the split. Candidates are sorted by score
descending; ties are broken by resume_id so the order is deterministic.
"""
import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, precision_recall_fscore_support

from ml.config import LABELS


# ---------- per-query ranking metrics (input: relevance list in ranked order) ----------

def dcg_at_k(rels, k) -> float:
    rels = np.asarray(rels, dtype=float)[:k]
    return float((rels / np.log2(np.arange(2, len(rels) + 2))).sum())


def ndcg_at_k(rels, k) -> float:
    ideal = dcg_at_k(sorted(rels, reverse=True), k)
    return dcg_at_k(rels, k) / ideal if ideal > 0 else 0.0


def reciprocal_rank(binary) -> float:
    hits = np.flatnonzero(binary)
    return 1.0 / (hits[0] + 1) if len(hits) else 0.0


def average_precision(binary) -> float:
    binary = np.asarray(binary)
    hits = np.flatnonzero(binary)
    if not len(hits):
        return 0.0
    return float((np.arange(1, len(hits) + 1) / (hits + 1)).mean())


def precision_at_k(binary, k) -> float:
    """Relevant in top k / min(k, n): a job with 3 candidates cannot show 5."""
    top = np.asarray(binary)[:k]
    return float(top.mean())


# ---------- split-level ranking evaluation ----------

def ranking_metrics(df: pd.DataFrame, score_col: str) -> tuple[dict, pd.DataFrame]:
    """Group by job, rank candidates by score, average per-job metrics.

    NDCG is computed on every eligible job (>= 2 candidates, >= 2 distinct labels — the Phase 2
    definition). MRR / MAP / P@k need at least one relevant AND one non-relevant candidate under
    the binary definition, otherwise every ranking scores the same; those jobs are counted separately.
    """
    rows, excluded = [], {"single_candidate": 0, "single_label": 0}
    for job_id, g in df.groupby("job_id", sort=True):
        if len(g) < 2:
            excluded["single_candidate"] += 1
            continue
        if g["label_id"].nunique() < 2:
            excluded["single_label"] += 1
            continue
        ranked = g.sort_values([score_col, "resume_id"], ascending=[False, True], kind="mergesort")
        rels = ranked["label_id"].to_numpy()
        binary = (rels > 0).astype(int)
        row = {"job_id": job_id, "n_candidates": len(g),
               "ndcg@5": ndcg_at_k(rels, 5), "ndcg@10": ndcg_at_k(rels, 10)}
        if 0 < binary.sum() < len(binary):
            row |= {"mrr": reciprocal_rank(binary), "map": average_precision(binary),
                    "p@1": precision_at_k(binary, 1), "p@5": precision_at_k(binary, 5)}
        rows.append(row)

    per_job = pd.DataFrame(rows, columns=["job_id", "n_candidates", "ndcg@5", "ndcg@10",
                                          "mrr", "map", "p@1", "p@5"])
    summary = {
        "jobs_total": int(df["job_id"].nunique()),
        "jobs_eligible": len(per_job),
        "jobs_excluded": excluded,
        "jobs_binary_eligible": int(per_job["mrr"].notna().sum()),
        "jobs_binary_trivial": int(per_job["mrr"].isna().sum()),
    }
    summary |= {m: round(float(per_job[m].mean()), 6) for m in ["mrr", "map", "ndcg@5", "ndcg@10", "p@1", "p@5"]}
    return summary, per_job


# ---------- classification: two thresholds over a similarity score ----------

def apply_thresholds(scores, thresholds) -> np.ndarray:
    """score < t1 -> 0 (No Fit); t1 <= score < t2 -> 1 (Potential); score >= t2 -> 2 (Good)."""
    return np.digitize(scores, thresholds)


def fit_thresholds(scores, labels, n_grid=99) -> list[float]:
    """Choose t1 < t2 from score percentiles maximising macro F1. Call on VALIDATION only."""
    scores, labels = np.asarray(scores), np.asarray(labels)
    grid = np.unique(np.quantile(scores, np.linspace(0.01, 0.99, n_grid)))
    best, best_f1 = None, -1.0
    for i, t1 in enumerate(grid):
        for t2 in grid[i + 1:]:
            f1 = f1_score(labels, apply_thresholds(scores, [t1, t2]), average="macro", zero_division=0)
            if f1 > best_f1:  # strict > keeps the first best pair: deterministic
                best, best_f1 = [float(t1), float(t2)], f1
    return best


def classification_metrics(labels, preds) -> dict:
    p, r, f1, _ = precision_recall_fscore_support(labels, preds, labels=[0, 1, 2],
                                                  average="macro", zero_division=0)
    return {
        "accuracy": round(float(accuracy_score(labels, preds)), 6),
        "macro_precision": round(float(p), 6),
        "macro_recall": round(float(r), 6),
        "macro_f1": round(float(f1), 6),
        "confusion_matrix": {"labels": LABELS,
                             "matrix": confusion_matrix(labels, preds, labels=[0, 1, 2]).tolist()},
    }


# ---------- chance-level references (model-independent) ----------

def reference_baselines(df: pd.DataFrame, seed: int, n_shuffles: int = 200) -> dict:
    """What a model with no signal would score on the same jobs: mean ranking metrics over
    random orderings, and the classification metrics of always predicting No Fit."""
    rng = np.random.default_rng(seed)
    runs = [ranking_metrics(df.assign(_random=rng.random(len(df))), "_random")[0] for _ in range(n_shuffles)]
    keys = ["mrr", "map", "ndcg@5", "ndcg@10", "p@1", "p@5"]
    majority = classification_metrics(df["label_id"], np.zeros(len(df), dtype=int))
    return {
        "random_ranking": {"n_shuffles": n_shuffles, "seed": seed,
                           **{k: round(float(np.mean([r[k] for r in runs])), 6) for k in keys}},
        "always_no_fit": {k: majority[k] for k in ["accuracy", "macro_precision", "macro_recall", "macro_f1"]},
    }
