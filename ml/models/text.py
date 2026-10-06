"""Conservative text normalisation shared by all models. Keeps case, punctuation and technical terms."""
import re

# Source text glues section headings to the next word ("SkillsPython", "SummaryHighly").
# Only these known headings are split; a general camel-case split would break JavaScript, PowerPoint.
_GLUED_HEADING = re.compile(
    r"\b(Summary|Skills|Highlights|Experience|Education|Qualifications|"
    r"Accomplishments|Certifications|Projects|Interests)(?=[A-Z])")
_NOISE = re.compile("[\ufffd\u200b\u2022\u25aa\u25cf\u00b7*|]")  # replacement char, zero-width space, bullets


def normalize(text) -> str:
    text = _NOISE.sub(" ", str(text))
    text = _GLUED_HEADING.sub(r"\1 ", text)
    return re.sub(r"\s+", " ", text).strip()
