"""Split flattened resume / job text into segments and label each segment with its section.

The dataset's text has lost its line breaks: bullets are glued together ("journal entriesPreparing
financial reports") and headings are glued to their content ("Required Qualifications1-3 years").
A segment is a sentence or a glued bullet. Skills are always matched on the full text, so a
segment boundary can never cut a skill name in half.
"""
import re

# Boundaries: after sentence punctuation + space, or a lowercase/digit glued to a capitalised word.
_BOUNDARY = re.compile(r"(?<=[.!?;:])\s+|(?<=[a-z0-9)])(?=[A-Z][a-z])")

# Headings are often glued into running text ("Data Analysis Professional Experience04/2018...",
# "projects as assigned Required Qualifications1-3 years"), so they are searched for anywhere.
# To count, a heading must start with a capital letter (after a non-letter or a glued lowercase
# letter) and be followed by a capital, digit, colon or the end of the text:
# "Requirements Bachelor's..." is a heading; "requirements are..." and "Experience in C#" are not.
_BEFORE_HEADING = r"(?:(?<![A-Za-z])|(?<=[a-z]))(?=[A-Z])"
_AFTER_HEADING = r"(?=\s*(?:$|[:\-A-Z0-9(]))"

JOB_HEADINGS = {
    "preferred": r"preferred qualifications?|preferred skills|preferred experience|preferred requirements|"
                 r"nice[- ]to[- ]haves?|bonus points|bonus|desired qualifications|desired skills|"
                 r"desired experience|pluses|preferred",
    "required": r"required qualifications?|minimum qualifications?|basic qualifications?|required skills|"
                r"required experience|requirements|job requirements|must[- ]haves?|what you need|"
                r"what you(?:'|’)ll need|what we(?:'|’)re looking for|who you are|qualifications|"
                r"skills and qualifications|skills (?:&|and) experience|experience and skills|"
                r"knowledge,? skills,? (?:and|&) abilities",
    "responsibilities": r"(?:key |primary |main |core |essential |major )?(?:job )?(?:responsibilities|duties)|"
                        r"essential (?:job )?functions|duties and responsibilities|what you(?:'|’)ll do|"
                        r"what you will do|the role|your role|day[- ]to[- ]day|in this role",
    "other": r"benefits|perks|about us|about the company|about the team|who we are|compensation|salary|"
             r"pay range|equal (?:employment )?opportunity|eeo|why join|our culture|location|"
             r"physical requirements|work environment",
}
RESUME_HEADINGS = {
    "experience": r"(?:work |professional |relevant |employment |career )?experience|"
                  r"work history|employment history|career history|employment",
    "education": r"education(?: and training)?|academic background|academics",
    "other": r"skills|technical skills|highlights|summary|professional summary|executive summary|"
             r"core competencies|certifications?|accomplishments|projects|interests|"
             r"additional information|languages|affiliations|activities|awards|objective|profile",
}

REQUIRED_CUE = re.compile(r"\b(?:required|requires?|requirements?|mandatory|must|essential|minimum|"
                          r"needs?|needed|necessary)\b", re.I)
PREFERRED_CUE = re.compile(r"\b(?:preferred|prefer|nice[- ]to[- ]have|bonus|desirable|desired|"
                           r"(?:is|are|a|considered a|big) plus|advantage(?:ous)?|ideally)\b", re.I)


def _compile(headings: dict) -> list[tuple[str, re.Pattern]]:
    # (?i:...) makes only the phrase case-insensitive; the lookarounds still see real capitals.
    return [(kind, re.compile(rf"{_BEFORE_HEADING}(?i:{pat}){_AFTER_HEADING}")) for kind, pat in headings.items()]


_JOB = _compile(JOB_HEADINGS)
_RESUME = _compile(RESUME_HEADINGS)


def segments(text: str) -> list[tuple[int, int]]:
    """(start, end) character spans of non-empty segments, in order."""
    spans, start = [], 0
    for m in _BOUNDARY.finditer(text):
        spans.append((start, m.start()))
        start = m.end()
    spans.append((start, len(text)))
    out = []
    for s, e in spans:  # strip surrounding spaces, keep exact offsets
        while s < e and text[s].isspace():
            s += 1
        while e > s and text[e - 1].isspace():
            e -= 1
        if e > s:
            out.append((s, e))
    return out


def labelled_segments(text: str, kind: str) -> list[tuple[int, int, str]]:
    """Segments with the section they belong to ("intro" before the first heading).
    kind = "job" or "resume"."""
    rules = _JOB if kind == "job" else _RESUME
    found = sorted((m.start(), -m.end(), i, section)  # same start: longest match, then earlier rule
                   for i, (section, rx) in enumerate(rules) for m in rx.finditer(text))
    heads = []  # (start, end, section), non-overlapping
    for start, neg_end, _, section in found:
        if not heads or start >= heads[-1][1]:  # skip "Qualifications" inside "Preferred Qualifications"
            heads.append((start, -neg_end, section))
    # Cut segments at both ends of every heading, so the heading is its own short segment.
    bounds = sorted({p for st, en, _ in heads for p in (st, en)})
    out, h, current = [], 0, "intro"
    for s, e in segments(text):
        cuts = [s] + [p for p in bounds if s < p < e] + [e]
        for a, b in zip(cuts, cuts[1:]):
            while a < b and text[a].isspace():
                a += 1
            while b > a and text[b - 1].isspace():
                b -= 1
            while h < len(heads) and heads[h][0] <= a:
                current = heads[h][2]
                h += 1
            if b > a:
                out.append((a, b, current))
    return out


def requirement_cue(sentence: str, position: int) -> str | None:
    """Explicit wording in the sentence, taking the cue nearest to the skill at `position`:
    in "Python required, AWS a plus", Python -> required and AWS -> preferred."""
    cues = [(abs(m.start() - position), "preferred") for m in PREFERRED_CUE.finditer(sentence)]
    cues += [(abs(m.start() - position), "required") for m in REQUIRED_CUE.finditer(sentence)]
    return min(cues)[1] if cues else None


def section_blocks(text: str, kind: str) -> list[tuple[int, int, str]]:
    """Consecutive segments of the same section merged into one block. Use this for patterns that
    a segment boundary could cut, e.g. the glued date range "04/2018toCurrent"."""
    out = []
    for s, e, section in labelled_segments(text, kind):
        if out and out[-1][2] == section:
            out[-1] = (out[-1][0], e, section)
        else:
            out.append((s, e, section))
    return out
