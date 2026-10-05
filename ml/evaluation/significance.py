"""Paired bootstrap over jobs: is model B really better than model A on the same test jobs?

    python -m ml.evaluation.significance tfidf semantic hybrid   -> results/significance_test.csv

Each model's per-job metric is recomputed from its saved test predictions with the shared metric
code. Jobs (not candidate rows) are resampled with replacement, keeping the pairing between models.
A difference is called significant at the 5% level when its 95% CI excludes 0. Run after all
choices are frozen; nothing here feeds back into any model decision. No multiple-comparison
correction is applied, which the report must keep in mind.
"""
import json
import sys
from itertools import combinations

import numpy as np
import pandas as pd

from ml.config import RESULTS_DIR, SEED
from ml.evaluation.metrics import ranking_metrics

METRICS = ["ndcg@10", "mrr", "map", "ndcg@5"]


def per_job(config: str, split: str = "test") -> pd.DataFrame:
    model = json.loads((RESULTS_DIR / f"{config}_{split}_metrics.json").read_text())["model"]
    pred = pd.read_csv(RESULTS_DIR / f"{config}_{split}_predictions.csv", keep_default_na=False)
    return ranking_metrics(pred, f"{model}_score")[1].set_index("job_id")


def paired_bootstrap(a: pd.Series, b: pd.Series, n: int = 10_000, seed: int = SEED) -> dict:
    """Mean of (b - a) over jobs present in both, with a percentile 95% CI."""
    diff = (b - a).dropna().sort_index().to_numpy()
    rng = np.random.default_rng(seed)
    means = diff[rng.integers(0, len(diff), size=(n, len(diff)))].mean(axis=1)
    low, high = np.percentile(means, [2.5, 97.5])
    return {"n_jobs": len(diff), "mean_diff": round(float(diff.mean()), 6),
            "ci95_low": round(float(low), 6), "ci95_high": round(float(high), 6),
            "p_two_sided": round(float(min(1.0, 2 * min((means <= 0).mean(), (means >= 0).mean()))), 4),
            "significant_5pct": bool(low > 0 or high < 0)}


def main(configs: list[str]):
    jobs = {c: per_job(c) for c in configs}
    rows = []
    for a, b in combinations(configs, 2):
        for m in METRICS:
            rows.append({"comparison": f"{b} - {a}", "metric": m, **paired_bootstrap(jobs[a][m], jobs[b][m])})
    out = pd.DataFrame(rows)
    out.to_csv(RESULTS_DIR / "significance_test.csv", index=False)
    print(out.to_string(index=False))


if __name__ == "__main__":
    main(sys.argv[1:] or ["tfidf", "semantic", "hybrid"])
