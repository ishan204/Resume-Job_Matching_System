"""Degree level required by a job and held by a candidate. Level only: the field of study is not
matched, and nothing about the person (age, nationality, ...) is inferred from education text."""
import re

from ml.features.sections import labelled_segments, requirement_cue

LEVELS = {1: "High school", 2: "Associate", 3: "Bachelor", 4: "Master", 5: "Doctorate"}
# Degrees are often glued to the previous word ("TrainingMaster of Science", "totoMBA"), so a word
# boundary also counts at a lowercase->Uppercase transition. Bare "master"/"associate" never count
# ("Scrum Master", "Sales Associate"); short abbreviations are case-sensitive and need context
# ("BS Electrical", "B.S:", "MS in ...", but not "MS Excel").
_B = r"(?:(?<![A-Za-z])|(?<=[a-z])(?=[A-Z]))"
_PATTERNS = [  # checked highest level first
    (5, r"(?i:ph\.?\s?d|doctorate|doctoral|juris doctor|doctor of)"),
    (4, r"(?i:master(?:['’]?s|\s+of|\s+degree|\s+in\b|\s*:)|mba|m\.b\.a|msc|m\.sc|m\.s\.|m\.eng)"
        r"|M\.?S(?=\s*(?:[:,(]|in\b|degree))"),
    (3, r"(?i:bachelor|b\.s\.?c?|b\.a\.|b\.tech|b\.e\.|bba|undergraduate degree|(?:4|four)[- ]year (?:college )?degree)"
        r"|B\.?S(?=\s*(?:[:,(]|in\b|degree|[A-Z][a-z]))|B\.?A(?=\s*(?:[:,(]|in\b|degree))|B\.?E(?=\s*[:,(])"),
    (2, r"(?i:associate['’]?s?\s+degree|associate of (?:arts|science|applied)|a\.a\.s)"),
    (1, r"(?i:high school|ged|secondary school)"),
]
_COMPILED = [(level, re.compile(rf"{_B}(?:{p})(?![a-z])")) for level, p in _PATTERNS]


def degree_levels(text: str) -> list[int]:
    return [level for level, rx in _COMPILED if rx.search(text)]


def job_education(text: str) -> dict:
    """Required level = lowest level named in non-preferred sentences ("Bachelor's or Master's" -> 3)."""
    required, preferred = [], []
    for s, e, section in labelled_segments(text, "job"):
        sentence = text[s:e]
        for level, rx in _COMPILED:
            if m := rx.search(sentence):
                status = requirement_cue(sentence, m.start()) or section
                (preferred if status == "preferred" else required).append(level)
    return {"required_level": min(required, default=None), "preferred_level": max(preferred, default=None)}


def resume_education(text: str) -> dict:
    levels = degree_levels(text)
    return {"highest_level": max(levels, default=None)}


def education_match(candidate_level, required_level) -> float | None:
    """1 if the candidate meets the level, 0.5 if one level below, 0 otherwise; None if unknown."""
    if candidate_level is None or required_level is None:
        return None
    gap = required_level - candidate_level
    return 1.0 if gap <= 0 else 0.5 if gap == 1 else 0.0
