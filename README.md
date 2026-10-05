# Explainable AI-Based Resume–Job Matching

Compares three resume–job matching approaches on a real dataset:

1. **TF-IDF baseline** — lexical overlap
2. **Semantic baseline** — BGE transformer embeddings
3. **Skill-Aware Hybrid** — *student-designed improvement*: semantic similarity + required/preferred
   skill coverage + experience + responsibility alignment, with grounded explanations

See [PROJECT_PLAN.md](PROJECT_PLAN.md) for the full plan and [docs/](docs/) for methodology.

> **Disclaimer:** This application is an academic research prototype and should not be used as the
> sole basis for employment decisions.

## Setup

```bash
python -m venv .venv
.venv\Scripts\activate          # Windows  (source .venv/bin/activate on Linux/macOS)
pip install -r requirements.lock
pytest
```

Rebuild the dataset (not committed):

```bash
python -m ml.dataset.download
python -m ml.dataset.prepare
python -m ml.dataset.validate
python -m ml.dataset.split
python -m ml.evaluation.leakage_check
```

## Status

| Phase | Status |
|---|---|
| 1 Project initialization | done |
| 2 Dataset pipeline (leakage check PASS) | done — see [docs/dataset.md](docs/dataset.md) |
| 3–13 | pending |

Results are added here only after experiments are actually run.
