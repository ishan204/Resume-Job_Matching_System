"""Verify that no resume crosses train/validation/test and report dataset stats.

    python -m ml.evaluation.leakage_check   (writes results/dataset_stats.json)

Exits non-zero if any resume (exact id or near-duplicate group) overlaps.
"""
import json
from itertools import combinations

import pandas as pd

from ml.config import DATA_PROCESSED, RESULTS_DIR, SEED
from ml.dataset.split import load_splits


def ranking_groups(df: pd.DataFrame) -> int:
    """Jobs usable for ranking: >= 2 candidates and not all the same label."""
    g = df.groupby("job_id")["label_id"].agg(["size", "nunique"])
    return int(((g["size"] >= 2) & (g["nunique"] >= 2)).sum())


def check(splits: dict[str, pd.DataFrame]) -> dict:
    overlaps = {}
    for a, b in combinations(splits, 2):
        for col in ("resume_id", "resume_group", "job_id"):
            overlaps[f"{a}/{b} {col}"] = len(set(splits[a][col]) & set(splits[b][col]))

    allrows = pd.concat(splits.values())
    total = len(allrows)
    return {
        "seed": SEED,
        "total_examples": total,
        "unique_resumes": int(allrows["resume_id"].nunique()),
        "unique_jobs": int(allrows["job_id"].nunique()),
        "splits": {
            name: {
                "rows": len(df),
                "fraction": round(len(df) / total, 4),
                "unique_resumes": int(df["resume_id"].nunique()),
                "unique_jobs": int(df["job_id"].nunique()),
                "ranking_groups": ranking_groups(df),
                "label_counts": df["label"].value_counts().to_dict(),
            }
            for name, df in splits.items()
        },
        "overlaps": overlaps,
        # Job overlap is allowed (we split by resume); only resume overlap is leakage.
        "no_resume_overlap": all(v == 0 for k, v in overlaps.items() if "resume" in k),
    }


def main():
    report = check(load_splits())
    prep = RESULTS_DIR / "prepare_report.json"
    if prep.exists():
        report["prepare"] = json.loads(prep.read_text())
    (RESULTS_DIR / "dataset_stats.json").write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))
    if not report["no_resume_overlap"]:
        raise SystemExit("LEAKAGE: resume overlap between splits")
    print("OK: no resume overlap between splits")


if __name__ == "__main__":
    main()
