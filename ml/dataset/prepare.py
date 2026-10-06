"""Step 2: clean, normalise, de-duplicate and group the raw dataset.

    python -m ml.dataset.prepare      (writes data/processed/all.parquet)

Resume identity: the dataset has no IDs, so
  resume_id    = hash of normalised resume text (exact identity)
  resume_group = connected component of near-duplicate resumes
                 (TF-IDF cosine >= NEAR_DUP_THRESHOLD)
Splitting by resume_group keeps lightly edited copies of one resume on the
same side of the split.
"""
import hashlib
import json
import re
import unicodedata

import pandas as pd
from scipy.sparse.csgraph import connected_components
from sklearn.feature_extraction.text import TfidfVectorizer

from ml.config import DATA_PROCESSED, DATA_RAW, LABELS, RESULTS_DIR
from ml.dataset.validate import inspect, validate

COLUMN_MAP = {"resume_text": "resume", "job_description_text": "job_description", "label": "label"}
NEAR_DUP_THRESHOLD = 0.9
_LABEL_KEYS = {re.sub(r"[^a-z]", "", label.lower()): label for label in LABELS}


def clean_text(text) -> str:
    text = unicodedata.normalize("NFKC", str(text) if text is not None else "")
    return re.sub(r"\s+", " ", text).strip()


def normalize_label(label) -> str:
    key = re.sub(r"[^a-z]", "", str(label).lower())
    if key not in _LABEL_KEYS:
        raise ValueError(f"unknown label: {label!r}")
    return _LABEL_KEYS[key]


def text_id(text: str) -> str:
    return hashlib.sha1(text.lower().encode("utf-8")).hexdigest()[:12]


def near_duplicate_groups(texts: pd.Series, threshold=NEAR_DUP_THRESHOLD) -> pd.Series:
    """Map each unique text to a group id; texts with cosine >= threshold share a group."""
    unique = texts.drop_duplicates().reset_index(drop=True)
    X = TfidfVectorizer(sublinear_tf=True).fit_transform(unique)
    sim = X @ X.T  # ponytail: O(n²) sparse product, fine for ~10k resumes; use ANN index beyond that
    _, comp = connected_components(sim >= threshold, directed=False)
    return texts.map(dict(zip(unique, (f"g{c}" for c in comp))))


def prepare(raw: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    df = raw.rename(columns=COLUMN_MAP)[list(COLUMN_MAP.values()) +
                                        (["original_split"] if "original_split" in raw else [])]
    report = {"raw_rows": len(df)}

    df["resume"] = df["resume"].map(clean_text)
    df["job_description"] = df["job_description"].map(clean_text)
    df["label"] = df["label"].map(normalize_label)
    empty = (df["resume"] == "") | (df["job_description"] == "")
    df = df[~empty].copy()
    report["dropped_empty"] = int(empty.sum())

    df["resume_id"] = df["resume"].map(text_id)
    df["job_id"] = df["job_description"].map(text_id)

    exact = df.duplicated(["resume_id", "job_id", "label"])
    df = df[~exact]
    report["dropped_exact_duplicates"] = int(exact.sum())

    # Same pair with different labels = ambiguous ground truth: drop all copies.
    conflict = df.duplicated(["resume_id", "job_id"], keep=False)
    df = df[~conflict].copy()
    report["dropped_conflicting_pairs"] = int(conflict.sum())

    df["resume_group"] = near_duplicate_groups(df["resume"])
    df["label_id"] = df["label"].map(LABELS.index)
    df = df.reset_index(drop=True)

    report |= {
        "rows": len(df),
        "unique_resumes": int(df["resume_id"].nunique()),
        "unique_jobs": int(df["job_id"].nunique()),
        "resume_groups": int(df["resume_group"].nunique()),
        "resumes_in_multiple_pairs": int((df["resume_id"].value_counts() > 1).sum()),
        "jobs_in_multiple_pairs": int((df["job_id"].value_counts() > 1).sum()),
        "near_duplicate_resumes_merged": int(df["resume_id"].nunique() - df["resume_group"].nunique()),
        "label_counts": df["label"].value_counts().to_dict(),
    }
    validate(df)
    return df, report


def main():
    parts = [pd.read_parquet(p).assign(original_split=p.stem) for p in sorted(DATA_RAW.glob("*.parquet"))]
    if not parts:
        raise SystemExit("no raw data — run: python -m ml.dataset.download")
    raw = pd.concat(parts, ignore_index=True)
    print("raw schema:", json.dumps(inspect(raw), indent=2))

    df, report = prepare(raw)
    DATA_PROCESSED.mkdir(parents=True, exist_ok=True)
    df.to_parquet(DATA_PROCESSED / "all.parquet", index=False)
    RESULTS_DIR.mkdir(exist_ok=True)
    (RESULTS_DIR / "prepare_report.json").write_text(json.dumps(report, indent=2))
    print("prepare report:", json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
