"""SEMANTIC_BASELINE: pretrained transformer embeddings + cosine similarity.

Zero-shot: the pretrained model is used as-is. Nothing is trained or fitted on the project data,
and labels are never used. The score is a cosine similarity, not a probability.

Long texts: the model reads at most `max_seq_length` tokens (512 for BGE). Two strategies:
  truncate    - embed only the first 510 tokens (the model's default behaviour)
  chunk_mean  - split the text into consecutive 510-token chunks, embed each, and average them
                weighted by chunk length, then re-normalise to length 1
"""
import hashlib

import numpy as np

from ml.models.text import normalize

MODEL_NAME = "semantic"
STRATEGIES = ("truncate", "chunk_mean")


def resolve_device(device: str = "auto") -> str:
    if device != "auto":
        return device
    import torch
    return "cuda" if torch.cuda.is_available() else "cpu"


def _key(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()


class SemanticMatcher:
    def __init__(self, model_name: str, revision: str | None = None, device: str = "auto",
                 batch_size: int = 16, long_text: str = "chunk_mean", query_instruction: str | None = None,
                 max_seq_length: int | None = None, cache_path=None, encoder=None):
        if long_text not in STRATEGIES:
            raise ValueError(f"long_text must be one of {STRATEGIES}")
        self.model_name, self.revision, self.batch_size = model_name, revision, batch_size
        self.long_text, self.query_instruction = long_text, query_instruction
        self.device = resolve_device(device)
        if encoder is None:
            from sentence_transformers import SentenceTransformer
            encoder = SentenceTransformer(model_name, revision=revision, device=self.device)
        if max_seq_length is not None:
            encoder.max_seq_length = max_seq_length
        self.encoder = encoder
        self.max_tokens = encoder.max_seq_length - 2  # room for the [CLS] and [SEP] special tokens
        self.cache_path = cache_path
        self._cache: dict[str, np.ndarray] = {}
        if cache_path is not None and cache_path.exists():
            with np.load(cache_path) as stored:
                self._cache = {k: stored[k] for k in stored.files}
        # texts_requested: rows asked for; texts_encoded: distinct new texts run through the model;
        # reused_cached: requests whose embedding existed before the call (earlier split or disk cache)
        self.stats = {"texts_requested": 0, "texts_encoded": 0, "chunks_encoded": 0, "reused_cached": 0}

    def fit(self, texts=None):
        """Zero-shot baseline: nothing is learned. Kept so every matcher has the same interface."""
        return self

    def _chunks(self, text: str) -> tuple[list[str], list[int]]:
        """Consecutive windows of max_tokens tokens, cut at token boundaries in the original text."""
        offsets = self.encoder.tokenizer(text, add_special_tokens=False, return_offsets_mapping=True,
                                         verbose=False)["offset_mapping"]
        if not offsets:
            return [text], [1]
        if self.long_text == "truncate":
            offsets = offsets[:self.max_tokens]
        windows = [offsets[i:i + self.max_tokens] for i in range(0, len(offsets), self.max_tokens)]
        return [text[w[0][0]:w[-1][1]] for w in windows], [len(w) for w in windows]

    def encode(self, texts) -> np.ndarray:
        """L2-normalised embeddings, one row per text. Each distinct text is encoded once
        (in-memory cache, optionally persisted to disk); repeated resumes/jobs reuse it."""
        texts = [normalize(t) for t in texts]
        keys = [_key(t) for t in texts]
        self.stats["texts_requested"] += len(texts)
        todo = sorted({k: t for k, t in zip(keys, texts) if k not in self._cache}.items())
        self.stats["reused_cached"] += sum(k in self._cache for k in keys)

        if todo:
            chunks, owners, weights = [], [], []
            for i, (_, text) in enumerate(todo):
                c, w = self._chunks(text)
                chunks += c
                weights += w
                owners += [i] * len(c)
            emb = self.encoder.encode(chunks, batch_size=self.batch_size, normalize_embeddings=True,
                                      convert_to_numpy=True, show_progress_bar=False,
                                      prompt=self.query_instruction)
            owners, weights = np.array(owners), np.array(weights, dtype=np.float64)
            for i, (key, _) in enumerate(todo):
                mask = owners == i
                v = (emb[mask].astype(np.float64) * weights[mask, None]).sum(axis=0)
                self._cache[key] = (v / np.linalg.norm(v)).astype(np.float32)
            self.stats["texts_encoded"] += len(todo)
            self.stats["chunks_encoded"] += len(chunks)
        return np.stack([self._cache[k] for k in keys])

    encode_resume = encode_job = encode  # BGE v1.5 needs no query/document distinction for doc-doc matching

    def score_pairs(self, resumes, jobs) -> np.ndarray:
        """Cosine similarity per (resume, job) row; vectors have length 1, so cosine = dot product."""
        R, J = self.encode(list(resumes)), self.encode(list(jobs))
        return (R.astype(np.float64) * J.astype(np.float64)).sum(axis=1)

    def score_pair(self, resume: str, job: str) -> dict:
        return {"model": MODEL_NAME, "score": float(self.score_pairs([resume], [job])[0])}

    def save_cache(self):
        if self.cache_path is not None and self._cache:
            self.cache_path.parent.mkdir(parents=True, exist_ok=True)
            np.savez(self.cache_path, **dict(sorted(self._cache.items())))
