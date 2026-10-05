"""Phase 3: TF-IDF matcher and the evaluation protocol (synthetic data only)."""
import numpy as np
import pandas as pd

from ml.evaluation.experiment import run
from ml.evaluation.metrics import fit_thresholds
from ml.models.tfidf import TFIDFMatcher, preprocess

TRAIN_TEXTS = [
    "Python developer building machine learning pipelines with PyTorch and SQL",
    "Data engineer Spark Python SQL ETL pipelines on AWS",
    "Pastry chef baking bread and cakes in a busy kitchen",
    "Registered nurse providing patient care in hospital wards",
    "Backend engineer C++ and C# services, Node.js APIs",
]


def _matcher():
    return TFIDFMatcher(min_df=1, max_df=1.0).fit(TRAIN_TEXTS)


def test_preprocessing_is_deterministic_and_conservative():
    raw = "SkillsPython, C++, C#  and Node.js • JavaScript� developer."
    out = preprocess(raw)
    assert out == preprocess(raw)
    assert out == "skills python, c++, c# and node.js javascript developer"


def test_technical_tokens_survive_tokenisation():
    vocab = _matcher().vectorizer.vocabulary_
    for token in ["c++", "c#", "node.js", "python", "pytorch"]:
        assert token in vocab


def test_identical_texts_score_high_and_unrelated_low():
    m = _matcher()
    same = m.score_pair(TRAIN_TEXTS[0], TRAIN_TEXTS[0])
    related = m.score_pair(TRAIN_TEXTS[0], TRAIN_TEXTS[1])["score"]
    unrelated = m.score_pair(TRAIN_TEXTS[0], TRAIN_TEXTS[2])["score"]
    assert same["model"] == "tfidf"
    assert abs(same["score"] - 1.0) < 1e-9
    assert related > unrelated
    assert unrelated < 0.1


def test_scores_within_cosine_range():
    m = _matcher()
    s = m.score_pairs(TRAIN_TEXTS + ["zzz unseen"], TRAIN_TEXTS[::-1] + ["zzz unseen"])
    assert np.all(s >= 0) and np.all(s <= 1 + 1e-9)
    assert s[-1] == 0.0  # no known vocabulary -> zero vector -> similarity 0, not NaN


def test_fit_once_reuse_and_unseen_words_not_learned(tmp_path):
    m = _matcher()
    vocab_before = dict(m.vectorizer.vocabulary_)
    m.score_pair("quantum zzzunseenword", "zzzunseenword")      # transform only
    assert m.vectorizer.vocabulary_ == vocab_before
    assert "zzzunseenword" not in vocab_before

    m.save(tmp_path / "m.joblib")
    loaded = TFIDFMatcher.load(tmp_path / "m.joblib")
    assert loaded.score_pair(TRAIN_TEXTS[0], TRAIN_TEXTS[1]) == m.score_pair(TRAIN_TEXTS[0], TRAIN_TEXTS[1])


def _splits():
    jobs = {"j1": "Python machine learning engineer PyTorch SQL",
            "j2": "Pastry chef bread cakes kitchen"}
    resumes = {f"r{i}": t for i, t in enumerate(TRAIN_TEXTS)}

    def make(rows):
        return pd.DataFrame([{"resume": resumes[r], "job_description": jobs[j], "resume_id": r, "job_id": j,
                              "resume_group": "g" + r, "label_id": l, "label": ["No Fit", "Potential Fit", "Good Fit"][l]}
                             for r, j, l in rows])
    train = make([("r0", "j1", 2), ("r2", "j2", 2), ("r3", "j1", 0)])
    validation = make([("r1", "j1", 1), ("r2", "j1", 0), ("r0", "j2", 0), ("r2", "j2", 2), ("r4", "j1", 1)])
    test = make([("r0", "j1", 2), ("r3", "j1", 0), ("r4", "j1", 1), ("r2", "j2", 2), ("r3", "j2", 0)])
    return {"train": train, "validation": validation, "test": test}


def test_protocol_preserves_ids_and_freezes_thresholds_on_validation():
    splits = _splits()
    params = {"min_df": 1, "max_df": 1.0}
    _, preds, metrics = run("tfidf", splits, params)

    for split in ("validation", "test"):
        p = preds[split]
        assert list(p[["resume_id", "job_id", "resume_group", "label_id"]].itertuples(index=False)) == \
               list(splits[split][["resume_id", "job_id", "resume_group", "label_id"]].itertuples(index=False))
        assert "tfidf_score" in p

    v = preds["validation"]
    assert metrics["test"]["classification"]["thresholds"] == fit_thresholds(v["tfidf_score"], v["label_id"])

    # Changing TEST labels must not change thresholds (they come from validation only).
    flipped = dict(splits, test=splits["test"].assign(label_id=lambda d: 2 - d["label_id"]))
    _, _, metrics2 = run("tfidf", flipped, params)
    assert metrics2["test"]["classification"]["thresholds"] == metrics["test"]["classification"]["thresholds"]


def test_run_is_deterministic():
    a = run("tfidf", _splits(), {"min_df": 1, "max_df": 1.0})
    b = run("tfidf", _splits(), {"min_df": 1, "max_df": 1.0})
    assert a[2] == b[2]
    for split in ("validation", "test"):
        pd.testing.assert_frame_equal(a[1][split], b[1][split])
