"""TFIDF_BASELINE: TF-IDF vectors + cosine similarity.

The score is a cosine similarity in [0, 1], not a probability and not an accuracy.
It never sees labels.
"""
import re

import joblib
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer

MODEL_NAME = "tfidf"
DEFAULT_PARAMS = {"ngram_range": (1, 2), "min_df": 2, "max_df": 0.95, "sublinear_tf": True}

# Tokens: words of 2+ chars that may contain + # . inside or at the end (c++, c#, node.js, asp.net),
# or single characters (c, r). sklearn's default pattern would turn "C++" into nothing useful.
TOKEN_PATTERN = r"(?u)\b\w[\w+#.]*[\w+#]|\b\w\b"

# Source text glues section headings to the next word ("SkillsPython", "SummaryHighly").
# Only these known headings are split; a general camel-case split would break JavaScript, PowerPoint.
_GLUED_HEADING = re.compile(
    r"\b(Summary|Skills|Highlights|Experience|Education|Qualifications|"
    r"Accomplishments|Certifications|Projects|Interests)(?=[A-Z])")
_NOISE = re.compile(r"[�​•▪●·*|]")  # replacement char, zero-width space, bullets
_SENTENCE_DOT = re.compile(r"\.(?!\w)")                            # "python." -> "python", keeps "node.js"


def preprocess(text: str) -> str:
    text = _NOISE.sub(" ", str(text))
    text = _GLUED_HEADING.sub(r"\1 ", text)
    text = _SENTENCE_DOT.sub(" ", text.lower())
    return re.sub(r"\s+", " ", text).strip()


class TFIDFMatcher:
    def __init__(self, **params):
        self.params = {**DEFAULT_PARAMS, **params}
        self.params["ngram_range"] = tuple(self.params["ngram_range"])
        self.vectorizer = None

    def fit(self, texts):
        """Fit vocabulary + IDF on training texts only. Duplicates are removed so a resume
        reused across many pairs does not inflate document frequencies."""
        corpus = sorted({preprocess(t) for t in texts})
        self.vectorizer = TfidfVectorizer(lowercase=False, token_pattern=TOKEN_PATTERN,
                                          dtype=np.float64, **self.params).fit(corpus)
        return self

    def transform(self, texts):
        return self.vectorizer.transform([preprocess(t) for t in texts])

    def score_pairs(self, resumes, jobs) -> np.ndarray:
        """Cosine similarity per (resume, job) row. Rows are L2-normalised, so dot product = cosine."""
        R, J = self.transform(list(resumes)), self.transform(list(jobs))
        return np.asarray(R.multiply(J).sum(axis=1)).ravel()

    def score_pair(self, resume: str, job: str) -> dict:
        return {"model": MODEL_NAME, "score": float(self.score_pairs([resume], [job])[0])}

    def save(self, path):
        joblib.dump(self, path)

    @staticmethod
    def load(path) -> "TFIDFMatcher":
        return joblib.load(path)
