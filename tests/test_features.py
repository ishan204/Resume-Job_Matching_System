"""Phase 5: deterministic feature extraction (skills, sections, experience, education, duties)."""
import numpy as np
import pytest

from ml.features.education import degree_levels, education_match, job_education
from ml.features.experience import experience_match, job_experience, resume_experience
from ml.features.responsibilities import alignment, candidate_evidence, job_responsibilities
from ml.features.sections import labelled_segments
from ml.features.skills import SkillExtractor, skill_coverage
from ml.models.text import normalize

X = SkillExtractor()


def skills(text):
    return {m.skill for m in X.mentions(normalize(text))}


# ---------- skills ----------

@pytest.mark.parametrize("alias,canonical", [
    ("ReactJS", "React"), ("React.js", "React"), ("NodeJS", "Node.js"), ("Postgres", "PostgreSQL"),
    ("ML", "Machine Learning"), ("K8s", "Kubernetes"), ("T-SQL", "SQL"), ("ASP.NET", ".NET"),
    ("Amazon Web Services", "AWS"), ("MS Excel", "Microsoft Excel"), ("Golang", "Go")])
def test_alias_normalisation(alias, canonical):
    assert skills(f"Experience with {alias} daily") == {canonical}


@pytest.mark.parametrize("a,b", [("Python", "Java"), ("AWS", "Azure"), ("React", "Angular"),
                                 ("PostgreSQL", "MongoDB"), ("Docker", "Kubernetes"), ("JavaScript", "Java")])
def test_distinct_technologies_stay_distinct(a, b):
    assert skills(f"We use {a}.") == {a}
    assert skills(f"We use {b}.") == {b}
    assert skills(f"{a} and {b}") == {a, b}


def test_longest_alias_wins_and_ambiguous_words_ignored():
    assert skills("JavaScript developer") == {"JavaScript"}           # not also Java
    assert skills("PostgreSQL and MySQL") == {"PostgreSQL", "MySQL"}  # not also SQL
    assert skills("react quickly to digital change in Spring 2019; R&D; go to market") == set()


def test_glued_text_boundaries():
    assert skills(normalize("SkillsPython, Tableau")) == {"Python", "Tableau"}
    assert skills("monthly reportsExcel modelsPreparing") == {"Microsoft Excel"}


def test_required_preferred_uncertain_classification():
    job = normalize("Responsibilities Build services in Go. Required Qualifications 3+ years Python and SQL. "
                    "Must have AWS. Preferred Qualifications Docker. Python required, Terraform a plus. "
                    "About us We love Tableau.")
    status = {k: v["status"] for k, v in X.job_skills(job).items()}
    assert status == {"Python": "required", "SQL": "required", "AWS": "required", "Docker": "preferred",
                      "Terraform": "preferred", "Tableau": "uncertain"}


def test_skill_evidence_is_the_source_sentence():
    job = normalize("Must have AWS experience. Nice to have Docker.")
    js = X.job_skills(job)
    assert js["AWS"]["evidence"] == "Must have AWS experience."
    resume = normalize("Summary Engineer. Experience Deployed services on AWS daily.")
    assert "AWS" in X.resume_skills(resume)["AWS"]


def test_coverage_matched_missing_and_counts():
    job = {"Python": {"status": "required"}, "SQL": {"status": "required"}, "AWS": {"status": "required"},
           "Docker": {"status": "preferred"}, "Tableau": {"status": "uncertain"}}
    cov = skill_coverage(job, {"Python": "", "SQL": "", "Docker": "", "Tableau": ""}, alpha=0.5)
    assert cov["matched_required_skills"] == ["Python", "SQL"] and cov["missing_required_skills"] == ["AWS"]
    assert cov["required_skill_coverage"] == pytest.approx(2 / 3)
    assert cov["preferred_skill_coverage"] == 1.0
    assert cov["weighted_skill_coverage"] == pytest.approx((2 + 0.5) / (3 + 0.5))
    assert cov["job_skill_coverage"] == pytest.approx(4 / 5)
    assert cov["missing_required_skill_count"] == 1 and cov["uncertain_skills"] == ["Tableau"]


def test_no_required_skills_is_distinguishable_from_zero_matched():
    none = skill_coverage({"X": {"status": "uncertain"}}, {}, 0.5)
    zero = skill_coverage({"X": {"status": "required"}}, {}, 0.5)
    assert none["required_skill_coverage"] == zero["required_skill_coverage"] == 0.0
    assert none["required_skill_count"] == 0 and zero["required_skill_count"] == 1


# ---------- sections ----------

def test_glued_headings_are_found_mid_text():
    t = normalize("projects as assigned Required Qualifications1-3 years of accounting experience")
    assert [k for *_, k in labelled_segments(t, "job")][-1] == "required"
    r = normalize("Data Analysis Professional Experience04/2018toCurrentSenior Analyst. Education Bachelor")
    kinds = [k for *_, k in labelled_segments(r, "resume")]
    assert "experience" in kinds and kinds[-1] == "education"
    assert "experience" not in [k for *_, k in labelled_segments("Coding Experience in C# daily.", "resume")]


# ---------- experience ----------

@pytest.mark.parametrize("text,lo,hi", [
    ("2+ years of experience", 2, None), ("at least 3 years of experience", 3, None),
    ("5 years experience in accounting", 5, None), ("5-7 years of relevant experience", 5, 7),
    ("minimum of two (2) years experience", 2, None), ("3 or more years of experience", 3, None)])
def test_job_experience_patterns(text, lo, hi):
    e = job_experience(normalize(text))
    assert (e["required_min_years"], e["required_max_years"]) == (lo, hi)


def test_job_experience_preferred_and_non_experience_numbers():
    e = job_experience("7+ years experience preferred. 2 years experience required. Founded 25 years ago.")
    assert e["required_min_years"] == 2 and e["preferred_years"] == 7


def test_resume_experience_merges_overlaps_and_skips_education():
    r = normalize("Experience Analyst 01/2015 to 12/2017 Acme. Consultant 06/2016 - 06/2019 Beta. "
                  "Education Bachelor of Science 2005 - 2009")
    e = resume_experience(r)
    assert e["source"] == "dates" and e["date_ranges"] == 2
    assert e["total_years"] == pytest.approx(4.42, abs=0.01)  # 01/2015..06/2019 once, not 3 + 3 years


def test_resume_present_uses_latest_explicit_date_and_stated_fallback():
    e = resume_experience(normalize("Experience Lead 01/2010 to 01/2014 X. Manager 03/2016toCurrent Y."))
    assert e["total_years"] == pytest.approx(4.0)  # "Current" = latest explicit date (03/2016)
    s = resume_experience("Summary 8 years of experience in sales. No dates here.")
    assert s == {"total_years": 8.0, "source": "stated", "date_ranges": 0, "stated_years": 8}


def test_experience_match_is_graded_and_bounded():
    assert experience_match(6, 5) == 1.0
    assert experience_match(3, 5) == pytest.approx(0.6)
    assert experience_match(0, 5) == 0.0
    assert experience_match(None, 5) is None and experience_match(4, None) is None


# ---------- education ----------

def test_degree_levels_avoid_false_friends():
    assert degree_levels("Scrum Master, Sales Associate, MS Excel") == []
    assert degree_levels("TrainingMaster of Science") == [4]
    assert degree_levels("BS Electrical Engineering") == [3]
    assert job_education("Bachelor's degree required. Master's degree preferred.") == \
        {"required_level": 3, "preferred_level": 4}
    assert education_match(4, 3) == 1.0 and education_match(2, 3) == 0.5 and education_match(1, 3) == 0.0


# ---------- responsibilities ----------

def test_responsibility_extraction():
    job = normalize("About us We are great. Responsibilities Prepare monthly financial reports for leadership. "
                    "Reconcile bank accounts every week. Benefits Health insurance for all staff members.")
    duties, from_section = job_responsibilities(job)
    assert from_section and duties == ["Prepare monthly financial reports for leadership.",
                                       "Reconcile bank accounts every week."]
    resume = normalize("Summary Accountant. Experience Prepared monthly financial reports for the CFO. "
                       "Education Bachelor of Science in Accounting at State University")
    assert candidate_evidence(resume) == ["Prepared monthly financial reports for the CFO."]


def test_alignment_score_and_bounds():
    J = np.array([[1.0, 0.0], [0.0, 1.0]])
    C = np.array([[1.0, 0.0], [0.6, 0.8]])
    score, best = alignment(J, C)
    assert score == pytest.approx((1.0 + 0.8) / 2)
    assert best[0] == (0, 0, 1.0)
    assert -1 <= score <= 1
    assert alignment(np.empty((0, 2)), C) == (None, [])


# ---------- Phase 6 regression: requirement cues glued to the next word ----------

def test_glued_requirement_cue_regression():
    from ml.features.sections import requirement_cue
    job = normalize("Responsibilities Build reports with Tableau. RequiredSQL Experience8 years preferred Docker.")
    old = X.job_skills(job)                    # Phase 5 behaviour, kept for reproducibility
    new = X.job_skills(job, glued_cues=True)
    assert old["SQL"]["status"] != "required"  # the documented Phase 5 miss
    assert new["SQL"]["status"] == "required"
    assert new["Docker"]["status"] == "preferred"
    assert requirement_cue("RequiredSQL", 8, glued_cues=True) == "required"
    assert requirement_cue("assignedPreferredDocker", 17, glued_cues=True) == "preferred"
    # no new false cues inside ordinary words
    for word in ["Mustang", "Needham", "Requirementsengineering"]:
        assert requirement_cue(word, 0, glued_cues=True) is None
