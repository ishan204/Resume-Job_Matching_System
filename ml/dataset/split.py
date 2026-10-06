"""Step 4: leakage-safe 70/15/15 split grouped by resume_group.

    python -m ml.dataset.split
    (writes data/splits/{train,validation,test}.csv and split_summary.json)

The original Hugging Face train/test split is ignored on purpose: it is not
grouped by resume, so the same resume can sit on both sides.
"""
import hashlib
import json

import pandas as pd
from sklearn.model_selection import GroupShuffleSplit

from ml.config import DATA_PROCESSED, DATA_SPLITS, SEED, SPLIT_RATIOS

SPLIT_NAMES = ("train", "validation", "test")


def grouped_split(df: pd.DataFrame, seed=SEED, group_col="resume_group") -> dict[str, pd.DataFrame]:
    holdout = SPLIT_RATIOS["validation"] + SPLIT_RATIOS["test"]
    first = GroupShuffleSplit(n_splits=1, test_size=holdout, random_state=seed)
    train_idx, rest_idx = next(first.split(df, groups=df[group_col]))
    rest = df.iloc[rest_idx]

    second = GroupShuffleSplit(n_splits=1, random_state=seed,
                               test_size=SPLIT_RATIOS["test"] / holdout)
    val_idx, test_idx = next(second.split(rest, groups=rest[group_col]))
    return {
        "train": df.iloc[train_idx].reset_index(drop=True),
        "validation": rest.iloc[val_idx].reset_index(drop=True),
        "test": rest.iloc[test_idx].reset_index(drop=True),
    }


def summarize(splits: dict[str, pd.DataFrame], seed=SEED) -> dict:
    return {
        "seed": seed,
        "ratios": SPLIT_RATIOS,
        "group_column": "resume_group",
        "splits": {
            name: {
                "rows": len(df),
                "unique_resumes": int(df["resume_id"].nunique()),
                "unique_resume_groups": int(df["resume_group"].nunique()),
                "unique_jobs": int(df["job_id"].nunique()),
                "label_counts": df["label"].value_counts().to_dict(),
            }
            for name, df in splits.items()
        },
    }


def load_splits() -> dict[str, pd.DataFrame]:
    return {name: pd.read_csv(DATA_SPLITS / f"{name}.csv", keep_default_na=False)
            for name in SPLIT_NAMES}


def main():
    splits = grouped_split(pd.read_parquet(DATA_PROCESSED / "all.parquet"))
    DATA_SPLITS.mkdir(parents=True, exist_ok=True)
    summary = summarize(splits)
    for name, part in splits.items():
        path = DATA_SPLITS / f"{name}.csv"
        part.to_csv(path, index=False)
        summary["splits"][name]["sha256"] = hashlib.sha256(path.read_bytes()).hexdigest()
        print(f"{name}: {len(part)} rows -> {path}")
    (DATA_SPLITS / "split_summary.json").write_text(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
