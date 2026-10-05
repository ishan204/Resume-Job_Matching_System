"""Step 3: leakage-safe 70/15/15 split grouped by resume_group.

    python -m ml.dataset.split   (writes data/processed/{train,validation,test}.parquet)

The original Hugging Face train/test split is ignored on purpose: it is not
grouped by resume, so the same resume can sit on both sides.
"""
import pandas as pd
from sklearn.model_selection import GroupShuffleSplit

from ml.config import DATA_PROCESSED, SEED, SPLIT_RATIOS


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


def load_splits() -> dict[str, pd.DataFrame]:
    return {name: pd.read_parquet(DATA_PROCESSED / f"{name}.parquet")
            for name in ("train", "validation", "test")}


def main():
    splits = grouped_split(pd.read_parquet(DATA_PROCESSED / "all.parquet"))
    for name, part in splits.items():
        part.to_parquet(DATA_PROCESSED / f"{name}.parquet", index=False)
        print(f"{name}: {len(part)} rows")


if __name__ == "__main__":
    main()
