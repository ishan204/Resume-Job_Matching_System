"""Phase 2: cleaning, label normalisation, duplicates, leakage-safe split."""
import pandas as pd
import pytest

from ml.dataset.prepare import clean_text, normalize_label, prepare
from ml.dataset.split import grouped_split
from ml.dataset.validate import validate
from ml.evaluation.leakage_check import check


def _raw(n_resumes=40, jobs_per_resume=3):
    rows = []
    for r in range(n_resumes):
        for j in range(jobs_per_resume):
            rows.append({
                "resume_text": f"Resume {r} python engineer {r * 7} unique words alpha{r} beta{r}",
                "job_description_text": f"Job {j} requires sql and python gamma{j}",
                "label": ["No Fit", "potential fit", " Good Fit "][(r + j) % 3],
            })
    return pd.DataFrame(rows)


def test_clean_text():
    assert clean_text("  a\u00a0b\n\n c\t") == "a b c"
    assert clean_text(None) == ""


def test_normalize_label():
    assert normalize_label(" good fit ") == "Good Fit"
    assert normalize_label("No_Fit") == "No Fit"
    with pytest.raises(ValueError):
        normalize_label("Maybe")


def test_prepare_removes_duplicates_and_conflicts():
    raw = _raw(5, 2)
    dup = raw.iloc[[0]]                                     # exact duplicate
    conflict = raw.iloc[[1]].assign(label="Good Fit")       # same pair, other label
    df, report = prepare(pd.concat([raw, dup, conflict, raw.iloc[[2]].assign(resume_text="  ")]))
    assert report["dropped_exact_duplicates"] == 1
    assert report["dropped_conflicting_pairs"] == 2         # both copies of the conflicting pair
    assert report["dropped_empty"] == 1
    assert len(df) == len(raw) - 1
    validate(df)


def test_near_duplicate_resumes_share_group():
    raw = pd.DataFrame({
        "resume_text": ["Senior data engineer Python Spark AWS ten years ETL pipelines",
                        "Senior data engineer Python Spark AWS ten years ETL pipelines.",
                        "Pastry chef baking bread cakes"],
        "job_description_text": ["job a", "job b", "job c"],
        "label": ["Good Fit", "No Fit", "No Fit"],
    })
    df, _ = prepare(raw)
    assert df["resume_id"].nunique() == 3
    assert df.loc[0, "resume_group"] == df.loc[1, "resume_group"] != df.loc[2, "resume_group"]


def test_grouped_split_has_no_resume_overlap():
    df, _ = prepare(_raw())
    splits = grouped_split(df)
    report = check(splits)
    assert report["no_resume_overlap"]
    assert sum(len(s) for s in splits.values()) == len(df)
    assert grouped_split(df)["test"].equals(splits["test"])  # deterministic with fixed seed


def test_original_split_leakage_counts_shared_resumes():
    from ml.dataset.original_leakage import original_split_leakage
    df = pd.DataFrame({"resume_id": ["a", "b", "c", "a", "d"], "original_split": ["train", "train", "train", "test", "test"]})
    assert original_split_leakage(df) == {"original_test_resumes": 2, "also_in_original_train": 1, "share": 0.5}
