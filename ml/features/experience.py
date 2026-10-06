"""Years-of-experience requirements (job) and estimated experience (resume), and their match.

Resume dates are messy ("04/2018toCurrent", "09/2015-06/2016", "January 2015 - Present").
The estimate is deliberately conservative and approximate:
  * only date ranges outside the Education section are used;
  * overlapping jobs are merged, so concurrent roles are not double-counted;
  * "Present/Current" = the latest explicit date in the same resume (resumes are undated);
  * year-only ranges count whole years ("2012 - 2015" = 3 years);
  * if no usable date range exists, the largest stated "N years of experience" is used instead.
"""
import re

from ml.features.sections import labelled_segments, requirement_cue, section_blocks

_WORDS = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8,
          "nine": 9, "ten": 10, "twelve": 12, "fifteen": 15}
_NUM = r"(\d{1,2}(?:\.\d)?|" + "|".join(_WORDS) + r")"
# "3+ years", "at least 3 years", "1-3 years", "5 to 7 years", "two (2) years", "3 or more years"
JOB_YEARS = re.compile(
    rf"(?<![\d.]){_NUM}\s*(?:\(\d{{1,2}}\)\s*)?\+?\s*(?:(?:-|–|—|to)\s*{_NUM}\s*\+?\s*)?"
    rf"(?:or more\s+|plus\s+)?(?:years?|yrs?)\b", re.I)
_EXPERIENCE_WORD = re.compile(r"experien", re.I)

_MONTHS = {m: i for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct",
                                       "nov", "dec"], start=1)}
_DATE = r"(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*,?\s*(?:19|20)\d\d|" \
        r"\d{1,2}\s*/\s*(?:19|20)\d\d|(?:19|20)\d\d)"
DATE_RANGE = re.compile(rf"(?<!\d)({_DATE})\s*(?:-|–|—|to|until|thru|through)\s*"
                        rf"({_DATE}|present|current|now|today)", re.I)
STATED_YEARS = re.compile(r"(?<![\d.])(\d{1,2})\s*\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:[\w-]+\s+){0,4}?"
                          r"experience", re.I)
_MAX_YEARS = 50


def _number(s: str) -> float:
    return float(_WORDS.get(s.lower(), s))


def job_experience(text: str, glued_cues: bool = False) -> dict:
    """Minimum / maximum required years and preferred years, from sentences that mention experience."""
    required, preferred, evidence = [], [], []
    for s, e, section in labelled_segments(text, "job"):
        sentence = text[s:e]
        if not _EXPERIENCE_WORD.search(sentence):
            continue
        for m in JOB_YEARS.finditer(sentence):
            lo = _number(m.group(1))
            hi = _number(m.group(2)) if m.group(2) else None
            if not 0 < lo <= 30:
                continue
            status = requirement_cue(sentence, m.start(), glued_cues) or section
            (preferred if status == "preferred" else required).append((lo, hi))
            evidence.append(sentence)
    # Several requirements ("5+ years Python, 2+ years AWS"): the strictest one is the requirement.
    lo, hi = max(required, default=(None, None), key=lambda x: x[0])
    return {"required_min_years": lo, "required_max_years": hi,
            "preferred_years": max((p[0] for p in preferred), default=None),
            "evidence": evidence[:3]}


def _parse(date: str, end: bool) -> int | None:
    """Months since year 0, or None. Year-only dates use January for both ends (whole years)."""
    d = date.lower().replace(" ", "")
    if m := re.match(r"(\d{1,2})/((?:19|20)\d\d)$", d):
        month, year = int(m.group(1)), int(m.group(2))
        if not 1 <= month <= 12:
            return None
    elif m := re.match(r"([a-z]{3})[a-z]*\.?,?((?:19|20)\d\d)$", d):
        month, year = _MONTHS.get(m.group(1)), int(m.group(2))
        if month is None:
            return None
    elif m := re.match(r"((?:19|20)\d\d)$", d):
        month, year = 1, int(m.group(1))
    else:
        return None
    return year * 12 + month - 1


def resume_experience(text: str) -> dict:
    ranges = []
    for s, e, section in section_blocks(text, "resume"):
        if section == "education":
            continue
        ranges += DATE_RANGE.findall(text[s:e])
    explicit = [_parse(d, end=False) for pair in ranges for d in pair if not d.isalpha()]
    explicit = [d for d in explicit if d is not None]
    latest = max(explicit, default=None)  # stands in for "Present"

    intervals = []
    for a, b in ranges:
        start = _parse(a, end=False)
        stop = latest if b.isalpha() else _parse(b, end=True)
        if start is not None and stop is not None and 0 <= stop - start <= _MAX_YEARS * 12:
            intervals.append((start, stop))

    months, cur = 0, None
    for a, b in sorted(intervals):  # union of intervals: overlapping roles count once
        if cur is None or a > cur[1]:
            if cur:
                months += cur[1] - cur[0]
            cur = [a, b]
        else:
            cur[1] = max(cur[1], b)
    if cur:
        months += cur[1] - cur[0]

    stated = max((int(m.group(1)) for m in STATED_YEARS.finditer(text) if int(m.group(1)) <= _MAX_YEARS),
                 default=None)
    if intervals:
        return {"total_years": round(months / 12, 2), "source": "dates", "date_ranges": len(intervals),
                "stated_years": stated}
    return {"total_years": float(stated) if stated is not None else None,
            "source": "stated" if stated is not None else None, "date_ranges": 0, "stated_years": stated}


def experience_match(candidate_years, required_years) -> float | None:
    """1.0 if the candidate meets the minimum, otherwise the fraction reached (3 of 5 years -> 0.6).
    None when either side is unknown: missing information is not treated as a mismatch."""
    if candidate_years is None or required_years is None:
        return None
    if required_years <= 0:
        return 1.0
    return min(1.0, candidate_years / required_years)
