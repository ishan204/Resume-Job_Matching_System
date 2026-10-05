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

Run the TF-IDF baseline (fits on train, thresholds on validation, scores test once):

```bash
python -m ml.evaluation.experiment tfidf
```

Run the semantic baseline (downloads BAAI/bge-base-en-v1.5 on first use, CPU is fine, ~15 min;
embeddings are cached in `artifacts/cache/`) and compare:

```bash
python -m ml.evaluation.experiment semantic
python -m ml.evaluation.compare tfidf semantic
```

Skill-Aware Hybrid: choose weights on validation (writes `config/matching_weights.json`), score test once,
then compare and test significance:

```bash
python -m ml.evaluation.hybrid_select
python -m ml.evaluation.experiment hybrid
python -m ml.evaluation.hybrid_select --test-ablation
python -m ml.evaluation.compare tfidf semantic hybrid
python -m ml.evaluation.significance tfidf semantic hybrid
```

## Status

| Phase | Status |
|---|---|
| 1 Project initialization | done |
| 2 Dataset pipeline (leakage check PASS) | done — see [docs/dataset.md](docs/dataset.md) |
| 3 TF-IDF baseline | done — test NDCG@10 0.7945, MRR 0.7638, macro F1 0.3938 (see [docs/algorithms.md](docs/algorithms.md)) |
| 4 Semantic baseline (BGE) | done — test NDCG@10 0.8231, MRR 0.7870, macro F1 0.4226 |
| 5 Skill-Aware Hybrid (student innovation) | done — test NDCG@10 0.8459, MRR 0.8341, macro F1 0.4386; gain over BGE significant on test but not replicated on validation |
| 6 Evaluation & robustness | done — across 5 repeated grouped splits hybrid > BGE in 5/5 (NDCG@10 +0.010, 95% CI [+0.002, +0.019]); see [docs/evaluation.md](docs/evaluation.md) |
| 7–13 | pending |

Results are added here only after experiments are actually run.
