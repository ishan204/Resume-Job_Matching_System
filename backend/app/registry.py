"""Loads the frozen research models once and builds per-request matchers around them.

Memory: the BGE encoder (the only large object) is loaded ONCE and shared by the semantic model and
the hybrid. Each request wraps it in fresh, lightweight SemanticMatcher / HybridMatcher objects so no
user text or embedding is kept after the request (the research classes cache per instance).
Nothing here re-fits or re-tunes anything: weights, scaling bounds and thresholds are read from the
committed Phase 3-6 files.
"""
import json
import logging
import threading
import time

import numpy as np
import pandas as pd

from backend.app.config import settings
from ml.config import DATA_SPLITS, EXPERIMENTS_DIR, RESULTS_DIR, ROOT
from ml.evaluation.experiment import ARTIFACTS, SEMANTIC_ARGS, build_tfidf
from ml.features.skills import default_extractor
from ml.models.hybrid import HybridMatcher
from ml.models.semantic import SemanticMatcher
from ml.models.tfidf import TFIDFMatcher

log = logging.getLogger("backend")


class ModelUnavailable(RuntimeError):
    pass


def _load_json(path):
    return json.loads(path.read_text())


class Registry:
    def __init__(self, encoder_factory=None, tfidf: TFIDFMatcher | None = None):
        """encoder_factory / tfidf can be injected (tests use a fake encoder and a tiny TF-IDF)."""
        self._encoder_factory = encoder_factory
        self._tfidf = tfidf
        self._encoder = None
        self._lock = threading.Lock()
        self.load_seconds: float | None = None
        self.sem_cfg = _load_json(EXPERIMENTS_DIR / f"{settings.semantic_config}.json")
        self.hyb_cfg = _load_json(EXPERIMENTS_DIR / f"{settings.hybrid_config}.json")
        self.frozen = _load_json(ROOT / self.hyb_cfg["weights_file"])
        self.result_names = {"tfidf": settings.tfidf_config, "semantic": settings.semantic_config,
                             "hybrid": settings.hybrid_config}
        self.thresholds, self.val_scores = {}, {}
        for model, name in self.result_names.items():
            m = _load_json(RESULTS_DIR / f"{name}_validation_metrics.json")
            self.thresholds[model] = m["classification"]["thresholds"]
            pred = pd.read_csv(RESULTS_DIR / f"{name}_validation_predictions.csv", usecols=[f"{model}_score"])
            self.val_scores[model] = np.sort(pred[f"{model}_score"].to_numpy())

    @property
    def loaded(self) -> bool:
        return self._encoder is not None and self._tfidf is not None

    def load(self):
        """Idempotent and thread-safe; the first call pays the cold-start cost."""
        with self._lock:
            if self.loaded:
                return
            start = time.perf_counter()
            if self._tfidf is None:
                self._tfidf = self._load_tfidf()
            if self._encoder is None:
                self._encoder = (self._encoder_factory or self._load_encoder)()
            default_extractor()
            self.load_seconds = round(time.perf_counter() - start, 2)
            log.info("models loaded in %.2fs", self.load_seconds)

    def _load_tfidf(self) -> TFIDFMatcher:
        path = ARTIFACTS / "tfidf.joblib"
        if path.exists():  # our own artifact written by `python -m ml.evaluation.experiment tfidf`
            return TFIDFMatcher.load(path)
        train = DATA_SPLITS / "train.csv"
        if train.exists():
            params = _load_json(EXPERIMENTS_DIR / f"{settings.tfidf_config}.json")
            return build_tfidf(pd.read_csv(train, keep_default_na=False), params)
        raise ModelUnavailable("TF-IDF model not found: run `python -m ml.evaluation.experiment tfidf` "
                               "(needs the dataset pipeline) to create artifacts/tfidf.joblib.")

    def _load_encoder(self):
        from sentence_transformers import SentenceTransformer

        from ml.models.semantic import resolve_device
        return SentenceTransformer(self.sem_cfg["model_name"], revision=self.sem_cfg.get("revision"),
                                   device=resolve_device(self.sem_cfg.get("device", "auto")))

    # ---------- per-request matchers (share the loaded encoder; keep no user data) ----------

    def tfidf(self) -> TFIDFMatcher:
        self.load()
        return self._tfidf

    def semantic(self) -> SemanticMatcher:
        self.load()
        kwargs = {k: self.sem_cfg[k] for k in SEMANTIC_ARGS if k in self.sem_cfg}
        return SemanticMatcher(self.sem_cfg["model_name"], encoder=self._encoder, **kwargs)

    def hybrid(self) -> HybridMatcher:
        return HybridMatcher(self.semantic(), weights=self.frozen["weights"], scaler=self.frozen["scaler"],
                             alpha=self.frozen["preferred_alpha"], glued_cues=self.hyb_cfg.get("glued_cues", False))

    def parser(self) -> HybridMatcher:
        """The hybrid's own parsers (no encoder needed for parsing)."""
        return HybridMatcher(semantic=None, glued_cues=self.hyb_cfg.get("glued_cues", False))

    def percentile(self, model: str, score: float) -> float:
        v = self.val_scores[model]
        return round(100.0 * np.searchsorted(v, score, side="left") / len(v), 1)
