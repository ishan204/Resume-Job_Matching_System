"""Request / response schemas (Pydantic). Scores are model scores, not probabilities."""
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

ModelName = Literal["tfidf", "semantic", "hybrid"]


class _Texts(BaseModel):
    resume: str = Field(..., description="Plain resume text (use /api/parse-resume to extract it from a file).")
    job_description: str = Field(..., description="Plain job-description text.")

    @field_validator("resume", "job_description")
    @classmethod
    def not_blank(cls, v: str, info) -> str:
        if not v or not v.strip():
            label = "Resume" if info.field_name == "resume" else "Job description"
            raise ValueError(f"{label} text cannot be empty.")
        return v


class MatchRequest(_Texts):
    model: ModelName = Field("hybrid", description="tfidf | semantic | hybrid")

    model_config = {"json_schema_extra": {"examples": [{
        "resume": "Experience Data Analyst 01/2018 to 01/2023. Built SQL and Python reports...",
        "job_description": "Required Qualifications 3+ years of experience with SQL and Python...",
        "model": "hybrid"}]}}


class CompareRequest(_Texts):
    model_config = {"json_schema_extra": {"examples": [{
        "resume": "Experience Data Analyst 01/2018 to 01/2023. Built SQL and Python reports...",
        "job_description": "Required Qualifications 3+ years of experience with SQL and Python..."}]}}


class JobRequest(BaseModel):
    job_description: str = Field(..., description="Plain job-description text.")

    @field_validator("job_description")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Job description text cannot be empty.")
        return v


class MatchResult(BaseModel):
    model: ModelName
    score: float = Field(..., description="Model score in the model's own range; NOT a probability.")
    category: str = Field(..., description="Strong / Potential / Weak match, from the model's frozen "
                                           "validation thresholds")
    thresholds: list[float]
    validation_percentile: float = Field(..., description="Share (0-100) of this model's validation-set "
                                                          "pair scores that are lower: a model-specific, "
                                                          "comparable position, not a probability")
    components: dict[str, float | None]
    matched_required_skills: list[str] | None = None
    missing_required_skills: list[str] | None = None
    matched_preferred_skills: list[str] | None = None
    missing_preferred_skills: list[str] | None = None
    experience: dict[str, Any] | None = None
    responsibility_similarity: float | None = None
    explanation: dict[str, Any]
    disclaimer: str


class CompareResult(BaseModel):
    tfidf: MatchResult
    semantic: MatchResult
    hybrid: MatchResult
    ranking: list[dict[str, Any]] = Field(..., description="Models ordered by validation percentile. Raw "
                                                           "scores are on different scales and not comparable.")
    note: str
    disclaimer: str


class Health(BaseModel):
    status: str
    version: str
    models: list[str]
    models_loaded: bool
    disclaimer: str


class ErrorBody(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorBody
