"""Schema inspection and validation of the processed dataset."""
import pandas as pd

from ml.config import DATA_PROCESSED, DATA_SPLITS, LABELS

REQUIRED_COLUMNS = ["resume", "job_description", "label", "label_id",
                    "resume_id", "job_id", "resume_group"]


def inspect(df: pd.DataFrame) -> dict:
    """Describe a raw frame: columns, dtypes, nulls, label counts."""
    return {
        "rows": len(df),
        "columns": {c: str(t) for c, t in df.dtypes.items()},
        "nulls": {c: int(n) for c, n in df.isna().sum().items()},
        "labels": df["label"].value_counts().to_dict() if "label" in df else {},
    }


def validate(df: pd.DataFrame) -> None:
    """Raise ValueError if the processed frame breaks any invariant."""
    missing = set(REQUIRED_COLUMNS) - set(df.columns)
    if missing:
        raise ValueError(f"missing columns: {sorted(missing)}")
    if df[REQUIRED_COLUMNS].isna().any().any():
        raise ValueError("null values present")
    if (df["resume"].str.len() == 0).any() or (df["job_description"].str.len() == 0).any():
        raise ValueError("empty text present")
    if not df["label"].isin(LABELS).all():
        raise ValueError(f"unknown labels: {set(df['label']) - set(LABELS)}")
    if (df["label"].map(LABELS.index) != df["label_id"]).any():
        raise ValueError("label_id does not match label")
    if df.duplicated(["resume_id", "job_id"]).any():
        raise ValueError("duplicate (resume, job) pairs present")


def main():
    """Step 3: validate the processed dataset (and the splits, if present)."""
    validate(pd.read_parquet(DATA_PROCESSED / "all.parquet"))
    print("OK: data/processed/all.parquet")
    for path in sorted(DATA_SPLITS.glob("*.csv")):
        validate(pd.read_csv(path, keep_default_na=False))
        print(f"OK: {path.relative_to(path.parents[2])}")


if __name__ == "__main__":
    main()
