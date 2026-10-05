"""Phase 3: ranking + classification metrics on hand-checkable fixtures."""
import numpy as np
import pandas as pd
import pytest
from sklearn.metrics import average_precision_score, ndcg_score

from ml.evaluation.metrics import (apply_thresholds, macro_f1, average_precision, classification_metrics,
                                   fit_thresholds, ndcg_at_k, precision_at_k, ranking_metrics,
                                   reciprocal_rank, reference_baselines)


def test_reciprocal_rank():
    assert reciprocal_rank([0, 0, 1, 1]) == pytest.approx(1 / 3)
    assert reciprocal_rank([1, 0]) == 1.0
    assert reciprocal_rank([0, 0]) == 0.0


def test_average_precision_by_hand_and_vs_sklearn():
    # hits at ranks 1 and 3: (1/1 + 2/3) / 2
    assert average_precision([1, 0, 1, 0]) == pytest.approx((1 + 2 / 3) / 2)
    scores = np.array([0.9, 0.8, 0.7, 0.6, 0.5])  # already in ranked order, no ties
    binary = np.array([0, 1, 0, 1, 1])
    assert average_precision(binary) == pytest.approx(average_precision_score(binary, scores))


def test_ndcg_by_hand_and_vs_sklearn():
    assert ndcg_at_k([2, 1, 0], 10) == pytest.approx(1.0)           # ideal order
    worst = (0 + 1 / np.log2(3) + 2 / np.log2(4)) / (2 + 1 / np.log2(3))
    assert ndcg_at_k([0, 1, 2], 10) == pytest.approx(worst)
    rels = np.array([1, 0, 2, 0, 1, 2])
    scores = np.linspace(1, 0.5, len(rels))                           # ranked order, no ties
    for k in (5, 10):
        assert ndcg_at_k(rels, k) == pytest.approx(ndcg_score([rels], [scores], k=k))


def test_precision_at_k_small_group():
    assert precision_at_k([1, 0, 1], 1) == 1.0
    assert precision_at_k([1, 0, 1], 5) == pytest.approx(2 / 3)       # denominator min(k, n)


def _pairs():
    rows = [  # job, resume, label, score
        ("a", "r1", 2, 0.9), ("a", "r2", 0, 0.8), ("a", "r3", 1, 0.1),   # eligible
        ("b", "r1", 1, 0.5),                                             # single candidate
        ("c", "r1", 0, 0.5), ("c", "r2", 0, 0.4),                        # single label
        ("d", "r1", 1, 0.2), ("d", "r2", 2, 0.3),                        # eligible, all relevant (binary trivial)
        ("e", "r1", 0, 0.5), ("e", "r2", 2, 0.5),                        # tie -> resume_id order (r1 first)
    ]
    return pd.DataFrame(rows, columns=["job_id", "resume_id", "label_id", "score"])


def test_ranking_metrics_grouping_and_exclusions():
    summary, per_job = ranking_metrics(_pairs(), "score")
    assert summary["jobs_total"] == 5
    assert summary["jobs_eligible"] == 3
    assert summary["jobs_excluded"] == {"single_candidate": 1, "single_label": 1}
    assert summary["jobs_binary_eligible"] == 2 and summary["jobs_binary_trivial"] == 1
    by_job = per_job.set_index("job_id")
    assert by_job.loc["a", "mrr"] == 1.0
    assert by_job.loc["e", "mrr"] == 0.5          # tie broken deterministically: r1 (label 0) ranked first
    assert np.isnan(by_job.loc["d", "mrr"])
    assert summary["mrr"] == pytest.approx(0.75)


def test_ranking_order_is_deterministic():
    df = _pairs()
    shuffled = df.sample(frac=1, random_state=0)
    assert ranking_metrics(df, "score")[0] == ranking_metrics(shuffled, "score")[0]


def test_thresholds_and_classification():
    scores = np.array([0.1, 0.15, 0.4, 0.45, 0.8, 0.85])
    labels = np.array([0, 0, 1, 1, 2, 2])
    t = fit_thresholds(scores, labels)
    assert t[0] < t[1]
    preds = apply_thresholds(scores, t)
    m = classification_metrics(labels, preds)
    assert m["accuracy"] == 1.0 and m["macro_f1"] == 1.0
    assert m["confusion_matrix"]["matrix"] == [[2, 0, 0], [0, 2, 0], [0, 0, 2]]
    assert list(apply_thresholds([0.0, 0.5, 0.5001, 1.0], [0.5, 0.9])) == [0, 1, 1, 2]


def test_reference_baselines_are_seeded():
    df = _pairs()
    a, b = reference_baselines(df, seed=1, n_shuffles=20), reference_baselines(df, seed=1, n_shuffles=20)
    assert a == b
    assert a["always_no_fit"]["accuracy"] == pytest.approx((df["label_id"] == 0).mean())


def test_comparison_requires_same_candidate_groups(tmp_path, monkeypatch):
    import json
    import ml.evaluation.compare as compare
    monkeypatch.setattr(compare, "RESULTS_DIR", tmp_path)
    ref = {"random_ranking": {k: 0.5 for k in compare.RANKING}}

    def write(name, mrr, pairs=10, ref=ref):
        m = {"pairs_scored": pairs, "chance_reference": ref,
             "ranking": {"jobs_eligible": 3, "jobs_binary_eligible": 2, **{k: mrr for k in compare.RANKING}},
             "classification": {"accuracy": 0.5, "macro_f1": 0.4}}
        (tmp_path / f"{name}_test_metrics.json").write_text(json.dumps(m))

    write("a", 0.6)
    write("b", 0.75)
    df = compare.comparison(["a", "b"])
    assert list(df.index) == ["random_ordering", "a", "b"]
    assert df.loc["b", "delta_mrr"] == pytest.approx(0.15)
    assert df.loc["b", "rel_mrr_%"] == pytest.approx(25.0)

    write("c", 0.7, pairs=9)
    with pytest.raises(ValueError):
        compare.comparison(["a", "c"])


def test_fast_macro_f1_matches_sklearn_exactly():
    from sklearn.metrics import f1_score
    rng = np.random.default_rng(0)
    for _ in range(200):
        y, p = rng.integers(0, 3, 50), rng.integers(0, 3, 50)
        p[rng.random(50) < 0.3] = 0                      # include absent-class / zero-division cases
        assert macro_f1(y, p) == f1_score(y, p, average="macro", zero_division=0)


def test_pairwise_deltas_and_paired_bootstrap():
    import ml.evaluation.compare as compare
    from ml.evaluation.significance import paired_bootstrap
    df = pd.DataFrame({k: [0.5, 0.6, 0.8] for k in compare.RANKING}, index=["random_ordering", "a", "b"])
    d = compare.pairwise_deltas(df).set_index("comparison")
    assert list(d.index) == ["a - random_ordering", "b - random_ordering", "b - a"]
    assert d.loc["b - a", "mrr"] == pytest.approx(0.2)
    a = pd.Series([0.5, 0.6, 0.7, 0.4] * 10, index=[f"j{i}" for i in range(40)])
    better = paired_bootstrap(a, a + 0.1, n=2000)
    assert better["mean_diff"] == pytest.approx(0.1) and better["significant_5pct"]
    same = paired_bootstrap(a, a, n=2000)
    assert same["mean_diff"] == 0 and not same["significant_5pct"]
    assert paired_bootstrap(a, a + 0.1, n=2000) == better  # seeded
