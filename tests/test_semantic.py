"""Phase 4: semantic matcher. Unit tests use a fake encoder (no network, no model download).

The real-model test is opt-in:  RUN_INTEGRATION=1 pytest -m integration
"""
import hashlib
import os
import re

import numpy as np
import pandas as pd
import pytest

import ml.evaluation.experiment as experiment
from ml.evaluation.metrics import ranking_metrics
from ml.models.semantic import SemanticMatcher, resolve_device

DIM = 256


class FakeEncoder:
    """Deterministic bag-of-words 'embedding' with the parts of the SentenceTransformer API we use."""
    max_seq_length = 8  # tiny, so chunking is exercised with short texts

    def __init__(self):
        self.encoded = []

    @staticmethod
    def tokenizer(text, **_):
        return {"offset_mapping": [m.span() for m in re.finditer(r"\S+", text)]}

    def get_embedding_dimension(self):
        return DIM

    def encode(self, texts, batch_size=32, normalize_embeddings=True, prompt=None, **_):
        self.encoded += list(texts)
        out = np.zeros((len(texts), DIM), dtype=np.float32)
        for i, t in enumerate(texts):
            for w in t.lower().split():
                out[i, int(hashlib.md5(w.encode()).hexdigest(), 16) % DIM] += 1
            out[i] /= max(np.linalg.norm(out[i]), 1e-12)
        return out


def matcher(**kw):
    return SemanticMatcher("fake-model", encoder=FakeEncoder(), **kw)


PY = "python developer pytorch machine learning"
PY2 = "python engineer machine learning models"
CHEF = "pastry chef bakes bread cakes"


def test_initialisation_and_device():
    m = matcher()
    assert m.max_tokens == FakeEncoder.max_seq_length - 2
    assert resolve_device("cpu") == "cpu" and resolve_device("auto") in ("cpu", "cuda")
    with pytest.raises(ValueError):
        matcher(long_text="nonsense")
    assert m.fit() is m  # zero-shot: fit is a no-op


def test_embeddings_deterministic_normalised_and_right_size():
    a, b = matcher().encode([PY, CHEF]), matcher().encode([PY, CHEF])
    assert a.shape == (2, DIM)
    np.testing.assert_array_equal(a, b)
    np.testing.assert_allclose(np.linalg.norm(a, axis=1), 1.0, rtol=1e-6)


def test_scores_identical_related_unrelated_and_range():
    m = matcher()
    same = m.score_pair(PY, PY)
    assert same["model"] == "semantic" and same["score"] == pytest.approx(1.0)
    assert m.score_pair(PY, PY2)["score"] > m.score_pair(PY, CHEF)["score"]
    s = m.score_pairs([PY, PY, CHEF], [PY2, CHEF, CHEF])
    assert np.all(s >= -1 - 1e-9) and np.all(s <= 1 + 1e-9)


def test_batch_scoring_matches_pair_scoring():
    m = matcher()
    batch = m.score_pairs([PY, CHEF, PY], [PY2, PY, CHEF])
    singles = [matcher().score_pair(r, j)["score"] for r, j in [(PY, PY2), (CHEF, PY), (PY, CHEF)]]
    np.testing.assert_allclose(batch, singles, rtol=1e-6)


def test_duplicate_texts_are_encoded_once():
    m = matcher()
    m.score_pairs([PY, PY, PY, CHEF], [PY2, PY2, CHEF, CHEF])
    assert m.stats["texts_requested"] == 8
    assert m.stats["texts_encoded"] == 3          # PY, PY2, CHEF
    assert sorted(m.encoder.encoded) == sorted([PY, PY2, CHEF])


def test_disk_cache_roundtrip(tmp_path):
    path = tmp_path / "cache.npz"
    m1 = matcher(cache_path=path)
    e1 = m1.encode([PY, CHEF])
    m1.save_cache()
    m2 = matcher(cache_path=path)
    np.testing.assert_array_equal(m2.encode([PY, CHEF]), e1)
    assert m2.encoder.encoded == [] and m2.stats["reused_cached"] == 2


def test_long_text_chunking():
    long_text = " ".join(f"w{i}" for i in range(20))       # 20 tokens, 6 per chunk -> 4 chunks
    chunks, weights = matcher()._chunks(long_text)
    assert weights == [6, 6, 6, 2] and " ".join(chunks) == long_text
    t_chunks, t_weights = matcher(long_text="truncate")._chunks(long_text)
    assert t_chunks == ["w0 w1 w2 w3 w4 w5"] and t_weights == [6]
    # chunk_mean sees the end of the document; truncate does not
    tail = "w18 w19"
    assert matcher().score_pair(long_text, tail)["score"] > 0
    assert matcher(long_text="truncate").score_pair(long_text, tail)["score"] == pytest.approx(0.0)


def _splits():
    texts = {"r0": PY, "r1": PY2, "r2": CHEF, "r3": "registered nurse patient care"}
    jobs = {"j1": "machine learning python role", "j2": "bakery chef bread"}

    def make(rows):
        return pd.DataFrame([{"resume": texts[r], "job_description": jobs[j], "resume_id": r, "job_id": j,
                              "resume_group": "g" + r, "label_id": l,
                              "label": ["No Fit", "Potential Fit", "Good Fit"][l]} for r, j, l in rows])
    return {"train": make([("r0", "j1", 2)]),
            "validation": make([("r0", "j1", 2), ("r2", "j1", 0), ("r3", "j1", 1), ("r2", "j2", 2), ("r0", "j2", 0)]),
            "test": make([("r1", "j1", 2), ("r2", "j1", 0), ("r3", "j1", 0), ("r2", "j2", 1), ("r1", "j2", 0)])}


@pytest.fixture
def fake_semantic(monkeypatch):
    monkeypatch.setattr(experiment, "_semantic",
                        lambda name, params: SemanticMatcher(name, encoder=FakeEncoder(), long_text=params["long_text"]))
    return {"model_name": "fake", "long_text": "chunk_mean"}


def test_experiment_output_schema_and_metric_compatibility(fake_semantic):
    _, preds, metrics = experiment.run("semantic", _splits(), fake_semantic)
    for split in ("validation", "test"):
        p = preds[split]
        assert list(p.columns) == ["resume_id", "job_id", "resume_group", "label", "label_id",
                                   "semantic_score", "predicted_label_id", "predicted_label"]
        # identical metric code path as TF-IDF
        assert ranking_metrics(p, "semantic_score")[0] == metrics[split]["ranking"]
        assert metrics[split]["model"] == "semantic"
        assert metrics[split]["model_params"]["fine_tuned"] is False
    assert metrics["test"]["classification"]["thresholds"] == metrics["validation"]["classification"]["thresholds"]


def test_scores_do_not_depend_on_labels(fake_semantic):
    splits = _splits()
    shuffled = {k: v.assign(label_id=v["label_id"][::-1].to_numpy()) for k, v in splits.items()}
    _, a, _ = experiment.run("semantic", splits, fake_semantic)
    _, b, _ = experiment.run("semantic", shuffled, fake_semantic)
    for split in ("validation", "test"):
        np.testing.assert_array_equal(a[split]["semantic_score"], b[split]["semantic_score"])


@pytest.mark.integration
@pytest.mark.skipif(os.environ.get("RUN_INTEGRATION") != "1", reason="set RUN_INTEGRATION=1 to load the real BGE model")
def test_real_bge_model():
    import json
    from ml.config import EXPERIMENTS_DIR
    cfg = json.loads((EXPERIMENTS_DIR / "semantic.json").read_text())
    m = SemanticMatcher(cfg["model_name"], revision=cfg["revision"], device="cpu")
    e = m.encode([PY, PY2, CHEF])
    assert e.shape == (3, 768)
    np.testing.assert_allclose(np.linalg.norm(e, axis=1), 1.0, rtol=1e-5)
    assert m.score_pair(PY, PY2)["score"] > m.score_pair(PY, CHEF)["score"]


def test_encoding_stats_are_snapshotted_per_split(fake_semantic):
    _, _, metrics = experiment.run("semantic", _splits(), fake_semantic)
    v = metrics["validation"]["model_params"]["encoding_stats"]["texts_requested"]
    t = metrics["test"]["model_params"]["encoding_stats"]["texts_requested"]
    assert v == 2 * 5 and t == 2 * 5 + 2 * 5  # cumulative counter, frozen at each split
