"""Phase 6: repeated grouped splits and the stratified job bootstrap (synthetic data)."""
import numpy as np
import pandas as pd
import pytest

from ml.evaluation.leakage_check import check
from ml.evaluation.repeated import repetitions, stratified_bootstrap

CFG = {"n_folds": 20, "test_folds": 3, "validation_folds": 3, "repetitions": 5, "seed": 2026}


def _pairs(n_groups=200, per_group=4):
    rng = np.random.default_rng(0)
    rows = [{"resume_group": f"g{g}", "resume_id": f"r{g}", "resume": f"resume text {g}", "job_id": f"j{rng.integers(30)}",
             "label_id": int(rng.integers(3)), "label": "x"} for g in range(n_groups) for _ in range(per_group)]
    return pd.DataFrame(rows)


def test_repetitions_are_grouped_disjoint_and_deterministic():
    df = _pairs()
    reps = repetitions(df, CFG)
    assert len(reps) == 5
    tested = []
    for idx in reps:
        split = {k: df.iloc[v] for k, v in idx.items()}
        assert check(split)["no_resume_overlap"]                       # no group crosses splits
        assert sum(len(v) for v in idx.values()) == len(df)            # every row used exactly once
        assert len(idx["test"]) / len(df) == pytest.approx(0.15, abs=0.04)
        assert len(idx["validation"]) / len(df) == pytest.approx(0.15, abs=0.04)
        tested.append(set(df.iloc[idx["test"]]["resume_group"]))
    for i in range(5):
        for j in range(i + 1, 5):
            assert not tested[i] & tested[j]                           # disjoint test sets
    again = repetitions(df, CFG)
    assert all(np.array_equal(a[k], b[k]) for a, b in zip(reps, again) for k in a)


def test_stratified_bootstrap():
    d = [np.full(30, 0.1), np.full(40, 0.1)]
    assert stratified_bootstrap(d, 2000, 1) == pytest.approx((0.1, 0.1))
    noisy = [np.random.default_rng(i).normal(0, 1, 50) for i in range(3)]
    low, high = stratified_bootstrap(noisy, 2000, 1)
    assert low < np.mean([x.mean() for x in noisy]) < high
    assert stratified_bootstrap(noisy, 2000, 1) == (low, high)
