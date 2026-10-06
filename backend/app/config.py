"""Backend settings. Everything can be overridden with environment variables (prefix RJM_)."""
import os
from dataclasses import dataclass, field

VERSION = "0.7.0"
MODELS = ("tfidf", "semantic", "hybrid")
DISCLAIMER = ("This system is an academic research prototype and should not be used as the sole basis "
              "for employment decisions.")


def _env_list(name: str, default: str) -> list[str]:
    return [x.strip() for x in os.environ.get(name, default).split(",") if x.strip()]


@dataclass(frozen=True)
class Settings:
    # Only the local Vite dev server by default; never "*".
    allowed_origins: list[str] = field(default_factory=lambda: _env_list(
        "RJM_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"))
    max_upload_mb: float = float(os.environ.get("RJM_MAX_UPLOAD_MB", "5"))
    max_text_chars: int = int(os.environ.get("RJM_MAX_TEXT_CHARS", "60000"))
    # Experiment configs served by the API (experiments/config/<name>.json).
    tfidf_config: str = os.environ.get("RJM_TFIDF_CONFIG", "tfidf")
    semantic_config: str = os.environ.get("RJM_SEMANTIC_CONFIG", "semantic")
    hybrid_config: str = os.environ.get("RJM_HYBRID_CONFIG", "hybrid_parserfix")
    preload_models: bool = os.environ.get("RJM_PRELOAD", "1") == "1"


settings = Settings()
