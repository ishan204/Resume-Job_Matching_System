"""Single source of truth for paths, seeds and model/dataset identifiers.

Every other module imports from here — nothing is hardcoded elsewhere.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_RAW = ROOT / "data" / "raw"
DATA_PROCESSED = ROOT / "data" / "processed"
DATA_SPLITS = ROOT / "data" / "splits"
CONFIG_DIR = ROOT / "config"
RESULTS_DIR = ROOT / "results"
EXPERIMENTS_DIR = ROOT / "experiments" / "config"

SEED = 42

# Dataset pinned to an exact Hugging Face revision for reproducibility.
DATASET_NAME = "cnamuangtoun/resume-job-description-fit"
DATASET_REVISION = "08978e21714984bb417547d2c0f9b477f5298163"
LABELS = ["No Fit", "Potential Fit", "Good Fit"]  # ordinal: 0, 1, 2

SPLIT_RATIOS = {"train": 0.70, "validation": 0.15, "test": 0.15}

# Embedding model is configurable; fallback used if the primary fails to load.
EMBEDDING_MODEL = "BAAI/bge-base-en-v1.5"
EMBEDDING_FALLBACK = "sentence-transformers/all-mpnet-base-v2"
