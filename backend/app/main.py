"""FastAPI backend for the resume-job matching research prototype.

Run:   uvicorn backend.app.main:app --reload        (docs at /docs and /redoc)
"""
import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, Query, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from backend.app import matching, parsing, research
from backend.app.config import DISCLAIMER, MODELS, VERSION, settings
from backend.app.registry import ModelUnavailable, Registry
from backend.app.schemas import (CompareRequest, CompareResult, ErrorResponse, Health, JobRequest, MatchRequest,
                                 MatchResult)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("backend")
DEMO = Path(__file__).resolve().parent.parent / "demo"


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str):
        self.status, self.code, self.message = status, code, message


def _error(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message}})


ERRORS = {422: {"model": ErrorResponse, "description": "Invalid input"},
          413: {"model": ErrorResponse, "description": "Input too large"},
          503: {"model": ErrorResponse, "description": "Model not available"}}


def create_app(registry: Registry | None = None, preload: bool | None = None) -> FastAPI:
    preload = settings.preload_models if preload is None else preload

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.registry = registry or Registry()
        if preload:
            app.state.registry.load()   # BGE loaded once, at startup
        yield

    app = FastAPI(title="Resume-Job Matching API", version=VERSION, lifespan=lifespan,
                  description="TF-IDF, BGE semantic and Skill-Aware Hybrid matching with explanations. "
                              + DISCLAIMER)
    app.add_middleware(CORSMiddleware, allow_origins=settings.allowed_origins, allow_credentials=False,
                       allow_methods=["GET", "POST"], allow_headers=["Content-Type"])

    @app.middleware("http")
    async def access_log(request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        # operational information only: never bodies, query values or file names
        log.info("%s %s %s %.0fms", request.method, request.url.path, response.status_code,
                 1000 * (time.perf_counter() - start))
        return response

    @app.exception_handler(ApiError)
    async def api_error(_, exc: ApiError):
        return _error(exc.status, exc.code, exc.message)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_, exc: RequestValidationError):
        first = exc.errors()[0] if exc.errors() else {}
        msg = str(first.get("msg", "Invalid request.")).removeprefix("Value error, ")
        where = ".".join(str(x) for x in first.get("loc", []) if x != "body")
        return _error(422, "INVALID_INPUT", f"{where}: {msg}" if where else msg)  # never echoes the input

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_, exc: StarletteHTTPException):
        return _error(exc.status_code, "NOT_FOUND" if exc.status_code == 404 else "HTTP_ERROR", str(exc.detail))

    @app.exception_handler(ModelUnavailable)
    async def unavailable(_, exc: ModelUnavailable):
        return _error(503, "MODEL_UNAVAILABLE", str(exc))

    @app.exception_handler(Exception)
    async def unexpected(_, exc: Exception):
        log.error("unhandled %s", type(exc).__name__)  # type only: no message, it could contain user text
        return _error(500, "INTERNAL_ERROR", "An unexpected error occurred.")

    def reg(request: Request) -> Registry:
        return request.app.state.registry

    def check_length(**texts: str):
        for name, text in texts.items():
            if len(text) > settings.max_text_chars:
                raise ApiError(413, "TEXT_TOO_LONG", f"{name} exceeds {settings.max_text_chars} characters.")

    # ------------------------------------------------------------------ general

    @app.get("/api/health", response_model=Health, tags=["general"])
    def health(r: Registry = Depends(reg)):
        """Liveness, version and model names."""
        return {"status": "ok", "version": VERSION, "models": list(MODELS), "models_loaded": r.loaded,
                "disclaimer": DISCLAIMER}

    @app.get("/api/models", tags=["general"])
    def models(r: Registry = Depends(reg)):
        """The three models served, with what each one measures and where its settings come from."""
        return {"models": [
            {"name": "tfidf", "label": "TF-IDF", "role": "traditional lexical baseline",
             "config": f"experiments/config/{settings.tfidf_config}.json", "thresholds": r.thresholds["tfidf"]},
            {"name": "semantic", "label": "Semantic BGE", "role": "AI baseline (zero-shot BAAI/bge-base-en-v1.5)",
             "config": f"experiments/config/{settings.semantic_config}.json", "thresholds": r.thresholds["semantic"]},
            {"name": "hybrid", "label": "Skill-Aware Hybrid", "role": "student-designed improvement",
             "config": f"experiments/config/{settings.hybrid_config}.json", "weights": r.frozen["weights"],
             "selected_on": r.frozen["selected_on"], "thresholds": r.thresholds["hybrid"]},
        ], "default": "hybrid", "disclaimer": DISCLAIMER}

    @app.get("/api/demo", tags=["general"])
    def demo():
        """A synthetic, non-sensitive resume and job description for trying the demo."""
        return {"resume": (DEMO / "resume.txt").read_text(encoding="utf-8"),
                "job_description": (DEMO / "job.txt").read_text(encoding="utf-8"),
                "note": "Synthetic example written for this project; it describes no real person or employer."}

    # ------------------------------------------------------------------ parsing

    @app.post("/api/parse-resume", tags=["parsing"], responses=ERRORS)
    async def parse_resume(file: UploadFile | None = File(None, description="PDF, DOCX or TXT resume"),
                           text: str | None = Form(None, description="Alternatively, plain resume text"),
                           include_text: bool = Query(False, description="Return the extracted plain text"),
                           r: Registry = Depends(reg)):
        """Extract text from an uploaded resume (or use `text`) and return structured information.
        The raw text is only returned when `include_text=true`. Uploads are processed in memory and
        never stored."""
        if file is not None:
            limit = int(settings.max_upload_mb * 1024 * 1024)
            data = await file.read(limit + 1)
            if len(data) > limit:
                raise ApiError(413, "FILE_TOO_LARGE", f"File exceeds {settings.max_upload_mb:g} MB.")
            try:
                raw = parsing.extract_text(file.filename or "", data)
            except parsing.ParseError as exc:
                raise ApiError(422, "UNSUPPORTED_OR_UNREADABLE_FILE", str(exc)) from None
        elif text is not None and text.strip():
            raw = text
        else:
            raise ApiError(422, "INVALID_INPUT", "Provide a resume file or non-empty resume text.")
        check_length(resume=raw)
        return {**parsing.parse_resume(r.parser(), raw, include_text), "disclaimer": DISCLAIMER}

    @app.post("/api/parse-job", tags=["parsing"], responses=ERRORS)
    def parse_job(body: JobRequest, r: Registry = Depends(reg)):
        """Required / preferred / uncertain skills with evidence, experience and education requirements,
        and responsibilities, using the same extractor as the hybrid model."""
        check_length(job_description=body.job_description)
        return parsing.parse_job(r.parser(), body.job_description)

    # ------------------------------------------------------------------ matching

    @app.post("/api/match", response_model=MatchResult, response_model_exclude_none=True, tags=["matching"],
              responses=ERRORS)
    def match(body: MatchRequest, r: Registry = Depends(reg)):
        """Score one resume against one job with the selected model. Only fields relevant to that model
        are returned. The score is a model score, not a probability."""
        check_length(resume=body.resume, job_description=body.job_description)
        return matching.match(r, body.model, body.resume, body.job_description)

    @app.post("/api/compare", response_model=CompareResult, response_model_exclude_none=True,
              tags=["matching"], responses=ERRORS)
    def compare(body: CompareRequest, r: Registry = Depends(reg)):
        """Run all three models on exactly the same input."""
        check_length(resume=body.resume, job_description=body.job_description)
        return matching.compare(r, body.resume, body.job_description)

    # ------------------------------------------------------------------ research (read-only)

    @app.get("/api/research/summary", tags=["research"])
    def research_summary():
        """Dataset facts, headline metrics, the hybrid-vs-BGE robustness result and limitations."""
        return research.summary()

    @app.get("/api/research/models", tags=["research"])
    def research_models():
        """Final model comparison (validation, original test, repeated-split mean/SD)."""
        return research.models()

    @app.get("/api/research/ablation", tags=["research"])
    def research_ablation():
        """Hybrid ablation on Phase 5 validation/test and across repeated splits."""
        return research.ablation()

    @app.get("/api/research/robustness", tags=["research"])
    def research_robustness():
        """Repeated grouped evaluation: per-split results, summary, paired differences with CIs."""
        return research.robustness()

    return app


app = create_app()
