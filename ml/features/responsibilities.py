"""Responsibility alignment: job duty statements vs the candidate's work-experience statements.

Not a second whole-document comparison: each job responsibility is matched to its single most
similar sentence from the candidate's experience section, and the scores are averaged.
"""
import numpy as np

from ml.features.sections import labelled_segments

MIN_WORDS = 4      # shorter fragments ("Assist with", headings) carry no duty information
MAX_STATEMENTS = 40   # ponytail: caps per-pair cost; long ads repeat themselves after ~40 sentences
MAX_EVIDENCE = 150


def _sentences(text: str, kind: str, keep) -> list[str]:
    out = []
    for s, e, section in labelled_segments(text, kind):
        piece = text[s:e]
        if keep(section) and len(piece.split()) >= MIN_WORDS and piece not in out:
            out.append(piece)
    return out


def job_responsibilities(text: str) -> tuple[list[str], bool]:
    """Sentences from responsibility sections; if the ad has none, every sentence outside the
    benefits/company sections (flagged from_section=False)."""
    found = _sentences(text, "job", lambda s: s == "responsibilities")
    if found:
        return found[:MAX_STATEMENTS], True
    return _sentences(text, "job", lambda s: s != "other")[:MAX_STATEMENTS], False


def candidate_evidence(text: str) -> list[str]:
    """Sentences from the experience section (work history, duties, achievements, projects listed
    there); falls back to everything except education if no experience heading was found."""
    found = _sentences(text, "resume", lambda s: s == "experience")
    return (found or _sentences(text, "resume", lambda s: s != "education"))[:MAX_EVIDENCE]


def alignment(job_vecs: np.ndarray, cand_vecs: np.ndarray, top: int = 3) -> tuple[float | None, list]:
    """Mean over job statements of the best cosine with any candidate sentence (vectors have length 1).
    Returns (score, [(job_index, candidate_index, similarity), ...] for the best-supported duties)."""
    if len(job_vecs) == 0 or len(cand_vecs) == 0:
        return None, []
    sims = job_vecs.astype(np.float64) @ cand_vecs.astype(np.float64).T
    best_c = sims.argmax(axis=1)
    best = sims[np.arange(len(job_vecs)), best_c]
    order = np.argsort(-best, kind="stable")[:top]
    return float(best.mean()), [(int(j), int(best_c[j]), float(best[j])) for j in order]
