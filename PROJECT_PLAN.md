# Project Plan

**Explainable AI-Based Resume–Job Matching Using Semantic and Skill-Aware Ranking**

> Research question: Does combining semantic similarity with explicit skill coverage,
> experience compatibility, and responsibility alignment improve resume–job matching
> compared with traditional TF-IDF and pure semantic matching?

Research inspiration: [ConFit v2](https://github.com/jasonyux/ConFit-v2) — a reference, not a system we reproduce.

---

## 1. Directory structure

```
.
├── config/                    # matching_weights.json, skills taxonomy   (Phase 5)
├── data/
│   ├── raw/                   # downloaded dataset        (git-ignored)
│   ├── processed/             # cleaned all.parquet       (git-ignored)
│   └── splits/                # train/validation/test.csv + split_summary.json (git-ignored)
├── ml/
│   ├── config.py              # paths, seed, dataset revision, model names
│   ├── dataset/               # download, prepare, validate, split   (Phase 2)
│   ├── parsing/               # resume + JD parsers (PDF/DOCX/TXT)   (Phase 5)
│   ├── features/              # skills, experience, education, feature vector
│   ├── models/                # tfidf.py, semantic.py, hybrid.py     (Phases 3–5)
│   └── evaluation/            # metrics, leakage_check, experiment protocol (Phases 2–3, 6–7)
├── artifacts/                 # tfidf.joblib, cache/ of BGE embeddings (git-ignored)
├── backend/                   # FastAPI app                            (Phase 8)
├── frontend/                  # React + TypeScript + Tailwind + Recharts (Phase 9)
├── experiments/config/        # frozen config of every experiment run
├── results/                   # CSVs + PNGs produced by experiments (committed)
├── tests/                     # pytest suite
├── docs/                      # viva-ready documentation
├── requirements.txt           # dependency ranges
└── requirements.lock          # exact installed versions (pip freeze)
```

## 2. Technology choices

| Concern | Choice | Why |
|---|---|---|
| Language | Python 3.13 | ML ecosystem |
| Lexical baseline | scikit-learn `TfidfVectorizer` | standard, explainable |
| Embeddings | `sentence-transformers`, **BAAI/bge-base-en-v1.5** (fallback all-mpnet-base-v2) | strong open retrieval model, runs on CPU |
| Dataset | Hugging Face `datasets`, pinned revision | reproducible |
| File parsing | `pypdf`, `python-docx` | deterministic, no LLM |
| Skill/experience extraction | regex + curated taxonomy | explainable, evidence-returning |
| Backend | FastAPI + Uvicorn | typed, auto docs |
| Frontend | React + TypeScript (Vite), Tailwind CSS, Recharts | clean, data-oriented UI |
| Tests | pytest, FastAPI TestClient; Vitest for frontend | |

No external LLM is used anywhere.

## 3. Dataset plan

- **Source:** `cnamuangtoun/resume-job-description-fit`, revision `08978e2`.
- **Schema (verified):** `resume_text`, `job_description_text`, `label` ∈ {No Fit, Potential Fit, Good Fit}.
  Original splits: train 6,241 / test 1,759.
- **No resume or job IDs are provided.** We derive them:
  `resume_id = sha1(normalised resume text)`, `job_id = sha1(normalised JD text)`, and
  `resume_group` = connected components of resumes with TF-IDF cosine ≥ 0.9 (near-duplicates).
- **Pipeline:** merge original train+test → normalise columns/labels → clean text →
  drop exact duplicate and label-conflicting pairs → group near-duplicate resumes →
  **grouped split by `resume_group`** 70/15/15 with seed 42 → `data/splits/*.csv`.
- **Phase 2 outcome (see docs/dataset.md):** 7,987 pairs from only 643 resumes / 351 jobs;
  the original HF split leaks 476 of 477 test resumes into train, so it is discarded.
  Grouped split: 5,537 / 1,259 / 1,191 rows; leakage check PASS; reproducibility PASS.

**Phase 3 outcome (see docs/algorithms.md):** TF-IDF test NDCG@10 0.7945 vs 0.7582 for random
ordering, MRR 0.7638 vs 0.7141; macro F1 0.3938 (always-No-Fit 0.2349). Weak but real lexical signal.

**Phase 4 outcome (see docs/algorithms.md):** zero-shot BGE (`bge-base-en-v1.5`, no instruction,
truncate to 512 tokens, chosen over chunk-averaging on validation NDCG@10). Test NDCG@10 0.8231,
MRR 0.7870, MAP 0.7531, macro F1 0.4226 — above TF-IDF on every metric (Δ NDCG@10 +0.029);
significance not yet tested. Potential vs Good Fit remain hard to separate.

**Phase 5 outcome (see docs/algorithms.md, docs/innovation.md):** Skill-Aware Hybrid (semantic 0.60,
required skills 0.15, preferred 0.05, experience 0.10, responsibilities 0.10; selected on validation
from 6 pre-declared weightings). Test: NDCG@10 0.8459, MRR 0.8341 — best of all models, hybrid − BGE
bootstrap CIs exclude 0. **Not replicated on validation** (hybrid − BGE NDCG@10 −0.003, CI spans 0).
Verdict: promising, not conclusive; repeated grouped splits needed (Phase 10).
- **Leakage check:** `ml/evaluation/leakage_check.py` asserts pairwise-empty resume-ID
  intersections across train/val/test and reports all counts.
- **Ranking groups:** a ranking query = one `job_id` with all its candidate resumes in that split.
  Jobs with < 2 candidates or no label variation cannot be ranked and are excluded from ranking
  metrics (count reported). Phase 2 measures how many usable groups exist — a key risk.

## 4. The three AI approaches

| # | Name | Role | Score |
|---|---|---|---|
| 1 | `TFIDF_BASELINE` | Traditional baseline | cosine(TF-IDF(R), TF-IDF(J)) |
| 2 | `SEMANTIC_BASELINE` | AI approach | cosine(BGE(R), BGE(J)) |
| 3 | `SKILL_AWARE_HYBRID` | **Student-designed improvement** | weighted sum below |

Optional (Phase 13 only): `CROSS_ENCODER` reranker on top-20.

## 5. Student innovation — Skill-Aware Hybrid

```
hybrid = w1·semantic_similarity
       + w2·required_skill_coverage
       + w3·preferred_skill_coverage
       + w4·experience_match
       + w5·responsibility_similarity        (Σw = 1, w ≥ 0)
```

Weights live only in `config/matching_weights.json`. Candidate configurations
(semantic-heavy / balanced / skill-heavy / experience-heavy, plus a small grid) are compared on
**validation only**; the winner is frozen before the test set is touched.
Required skills always weigh more than preferred skills (w2 > w3).

Hypotheses: **H0** hybrid does not significantly beat semantic; **H1** it does.
Decided on the test set with a paired test (Wilcoxon signed-rank / paired bootstrap on per-job NDCG@10).
If the hybrid loses, we report it and analyse why.

## 6. Evaluation methodology

- Same frozen test split and same ranking groups for every model.
- **Ranking (primary):** NDCG@5, NDCG@10, MRR, MAP, P@1, P@5 (graded gain: No=0, Potential=1, Good=2;
  "relevant" for MRR/MAP/P@k = label > 0, i.e. Potential or Good Fit). Every metrics file also
  records chance-level references (seeded random ordering, always-No-Fit). Shared protocol:
  `ml/evaluation/experiment.py`; metrics: `ml/evaluation/metrics.py`.
- **Classification (secondary):** each model's score → 3 classes via two thresholds chosen on
  validation; Accuracy, macro Precision/Recall/F1, confusion matrix per model.
- **Ablation (A–F):** semantic → +required → +preferred → +experience → +responsibilities → final.
  Each stage's weights re-tuned on validation, reported on test.
- Outputs: `results/weight_comparison.csv`, `model_comparison.csv/.png`, `ablation.csv/.png`,
  confusion matrices. Every run's config is saved in `experiments/config/`.
- Scores are similarities, never called probabilities or accuracy.

## 7. Implementation phases

| Phase | Deliverable | Commit |
|---|---|---|
| 1 ✅ | Repo, architecture, environment, docs skeleton | project initialization |
| 2 ✅ | Dataset pipeline, leakage check, grouped split | dataset pipeline |
| 3 ✅ | TF-IDF baseline | TF-IDF baseline |
| 4 ✅ | BGE semantic baseline | semantic baseline |
| 5 ✅ | Parsers, skills/experience/education features, hybrid | hybrid model |
| 6 | Metrics + evaluation engine | evaluation framework |
| 7 | Weight + ablation experiments (validation) | experiments |
| 8 | FastAPI backend | backend API |
| 9 | Functional React frontend | frontend |
| 10 | Final test-set experiments + repeated grouped splits (cross-validation) to check whether the hybrid gain replicates | experiments |
| 11 | Research/results page populated | frontend |
| 12 | Frontend polish | frontend |
| 13 | Optional cross-encoder | optional |

After each phase: run tests → inspect → fix → document → commit. No phase starts on a broken one.

## 8. Ethics

Protected attributes (gender, age, race, religion, nationality, marital status, photo, address)
are never features. Raw resume text is never logged. Disclaimer shown in app and README.
