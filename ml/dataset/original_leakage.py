"""How leaky is the dataset's ORIGINAL Hugging Face train/test split? (documents the Phase 2 finding)

    python -m ml.dataset.original_leakage   -> results/original_split_leakage.json

Uses the cleaned pairs and their original_split column; resumes are identified by resume_id
(hash of normalised text), exactly as in the leakage-safe pipeline.
"""
import json

import pandas as pd

from ml.config import DATA_PROCESSED, RESULTS_DIR


def original_split_leakage(df: pd.DataFrame) -> dict:
    train = set(df.loc[df.original_split == "train", "resume_id"])
    test = set(df.loc[df.original_split == "test", "resume_id"])
    return {"original_test_resumes": len(test), "also_in_original_train": len(test & train),
            "share": round(len(test & train) / len(test), 4) if test else 0.0}


def main():
    out = original_split_leakage(pd.read_parquet(DATA_PROCESSED / "all.parquet"))
    (RESULTS_DIR / "original_split_leakage.json").write_text(json.dumps(out, indent=2))
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
