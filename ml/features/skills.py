"""Deterministic skill extraction over the project taxonomy (config/skills.json), and coverage.

No LLM, no external API. Every extracted skill keeps the sentence it came from as evidence.
"""
import bisect
import json
import re
from dataclasses import dataclass
from functools import lru_cache

from ml.config import CONFIG_DIR
from ml.features.sections import labelled_segments, requirement_cue, segments

TAXONOMY = CONFIG_DIR / "skills.json"
STRENGTH = {"required": 2, "preferred": 1, "uncertain": 0}

# A word boundary, or a lowercase->Uppercase transition (text is glued: "ExcelPreparing").
_BEFORE = r"(?:(?<![A-Za-z0-9+#])|(?<=[a-z])(?=[A-Z]))"
_AFTER = r"(?:(?![A-Za-z0-9+#])|(?<=[a-z])(?=[A-Z]))"


def _containing(spans: list[tuple], pos: int) -> tuple:
    """The span (start, end, ...) that contains character position pos (spans sorted by start)."""
    return spans[max(bisect.bisect_right([sp[0] for sp in spans], pos) - 1, 0)]


@dataclass(frozen=True)
class Mention:
    skill: str      # canonical name
    text: str       # exactly as written
    start: int
    end: int


class SkillExtractor:
    def __init__(self, path=TAXONOMY):
        skills = json.loads(path.read_text(encoding="utf-8"))["skills"]
        self.category = {name: d["category"] for name, d in skills.items()}
        self._insensitive = {a: n for n, d in skills.items() for a in d.get("aliases", [])}
        self._sensitive = {a: n for n, d in skills.items() for a in d.get("case_sensitive", [])}
        # Longest alias first: at any position the regex prefers "javascript" over "java".
        aliases = sorted([(a, True) for a in self._insensitive] + [(a, False) for a in self._sensitive],
                         key=lambda x: (-len(x[0]), x[0]))
        body = "|".join(f"(?i:{re.escape(a)})" if insensitive else re.escape(a) for a, insensitive in aliases)
        self._pattern = re.compile(f"{_BEFORE}(?:{body}){_AFTER}")

    def mentions(self, text: str) -> list[Mention]:
        out = []
        for m in self._pattern.finditer(text):
            found = m.group(0)
            skill = self._sensitive.get(found) or self._insensitive[found.lower()]
            out.append(Mention(skill, found, m.start(), m.end()))
        return out

    def resume_skills(self, text: str) -> dict[str, str]:
        """skill -> evidence sentence (first mention) from a resume."""
        sentences = segments(text)
        out = {}
        for m in self.mentions(text):
            if m.skill not in out:
                s, e = _containing(sentences, m.start)
                out[m.skill] = text[s:e]
        return out

    def job_skills(self, text: str) -> dict[str, dict]:
        """skill -> {"status": required | preferred | uncertain, "evidence": sentence}.

        Status of one mention: the nearest explicit cue in its sentence ("must have", "a plus"),
        else the section it sits in ("Required Qualifications", "Preferred"), else "uncertain".
        A skill mentioned several times keeps its strongest status (required > preferred > uncertain).
        """
        pieces = labelled_segments(text, "job")   # section labels (cut at headings)
        sentences = segments(text)                 # whole sentences: cue words + evidence
        out = {}
        for m in self.mentions(text):
            section = _containing(pieces, m.start)[2]
            s, e = _containing(sentences, m.start)
            sentence = text[s:e]
            status = (requirement_cue(sentence, m.start - s)
                      or (section if section in ("required", "preferred") else "uncertain"))
            if m.skill not in out or STRENGTH[status] > STRENGTH[out[m.skill]["status"]]:
                out[m.skill] = {"status": status, "evidence": sentence}
        return out


@lru_cache(maxsize=1)
def default_extractor() -> SkillExtractor:
    return SkillExtractor()


def skill_coverage(job: dict[str, dict], resume: dict[str, str], alpha: float) -> dict:
    """Coverage of the job's required / preferred skills by the resume's skills (canonical names).

    required_skill_coverage = matched required / required count  (0.0 when the job lists none:
    check required_skill_count to tell "none detected" from "none matched").
    weighted_skill_coverage = (matched_req + alpha*matched_pref) / (req + alpha*pref), alpha < 1.
    """
    by_status = {k: sorted(s for s, v in job.items() if v["status"] == k) for k in STRENGTH}
    req, pref = by_status["required"], by_status["preferred"]
    m_req = [s for s in req if s in resume]
    m_pref = [s for s in pref if s in resume]
    all_skills = sorted(job)
    denom = len(req) + alpha * len(pref)
    return {
        "required_skill_count": len(req),
        "preferred_skill_count": len(pref),
        "uncertain_skill_count": len(by_status["uncertain"]),
        "required_skill_coverage": len(m_req) / len(req) if req else 0.0,
        "preferred_skill_coverage": len(m_pref) / len(pref) if pref else 0.0,
        "weighted_skill_coverage": (len(m_req) + alpha * len(m_pref)) / denom if denom else 0.0,
        "job_skill_coverage": sum(s in resume for s in all_skills) / len(all_skills) if all_skills else 0.0,
        "matched_required_skills": m_req,
        "missing_required_skills": [s for s in req if s not in resume],
        "matched_preferred_skills": m_pref,
        "missing_preferred_skills": [s for s in pref if s not in resume],
        "uncertain_skills": by_status["uncertain"],
        "missing_required_skill_count": len(req) - len(m_req),
        "missing_preferred_skill_count": len(pref) - len(m_pref),
    }
