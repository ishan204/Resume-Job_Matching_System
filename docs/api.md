# API contract (Phase 7)

FastAPI backend serving the frozen research models. This is the contract the React frontend uses.

> **Disclaimer.** This system is an academic research prototype and should not be used as the sole
> basis for employment decisions. Every match response repeats this in `disclaimer`.

## Running

```bash
uvicorn backend.app.main:app --reload            # http://127.0.0.1:8000
```

- Interactive docs: `/docs` (Swagger) and `/redoc`.
- Prerequisite: the TF-IDF artifact `artifacts/tfidf.joblib` (`python -m ml.evaluation.experiment tfidf`,
  which needs the dataset pipeline). If it is missing but `data/splits/train.csv` exists, TF-IDF is
  refitted from train at startup. BGE is downloaded from Hugging Face on first use (pinned revision).

| Environment variable | Default | Meaning |
|---|---|---|
| `RJM_ALLOWED_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | CORS allow-list (comma-separated; never `*`) |
| `RJM_MAX_UPLOAD_MB` | `5` | upload size limit |
| `RJM_MAX_TEXT_CHARS` | `60000` | max characters per resume / job text |
| `RJM_HYBRID_CONFIG` | `hybrid_parserfix` | served hybrid config (Phase 6 parser fix, frozen validation weights) |
| `RJM_PRELOAD` | `1` | load models at startup (`0` = on first request) |

## Model names

| `model` | Label | What the score is |
|---|---|---|
| `tfidf` | TF-IDF | cosine of TF-IDF word vectors (lexical overlap) |
| `semantic` | Semantic BGE | cosine of `BAAI/bge-base-en-v1.5` embeddings (topic similarity) |
| `hybrid` (default) | Skill-Aware Hybrid | weighted average of semantic, required/preferred skill coverage, experience and responsibility alignment |

**Scores are model scores, not probabilities.** The three models' scores are on different scales.
Two derived fields make them readable:

- `category`: "Weak match" / "Potential match" / "Strong match", using the model's two frozen
  thresholds (`thresholds`). These were learned on the validation split to separate
  No / Potential / Good Fit.
- `validation_percentile`: the share (0–100) of that model's own validation-pair scores that are
  lower. This is the only comparable position across models.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | status, version, model names, whether models are loaded |
| GET | `/api/models` | the three models, their configs, thresholds, hybrid weights |
| GET | `/api/demo` | synthetic demo resume + job description |
| POST | `/api/parse-resume` | file (PDF/DOCX/TXT) or text → structured resume |
| POST | `/api/parse-job` | job text → requirements, responsibilities, evidence |
| POST | `/api/match` | one model on one resume/job pair |
| POST | `/api/compare` | all three models on the same pair |
| GET | `/api/research/summary` | dataset facts, headline metrics, robustness result, limitations |
| GET | `/api/research/models` | final model comparison (validation, test, repeated mean/SD) |
| GET | `/api/research/ablation` | hybrid ablation (Phase 5 val/test, repeated splits) |
| GET | `/api/research/robustness` | repeated grouped splits: per split, summary, paired differences + CIs |

Research endpoints only **read committed result files**; no experiment is ever run by the API.

### POST /api/parse-resume

`multipart/form-data` with **either** `file` (`.pdf`, `.docx`, `.txt`, ≤ 5 MB) **or** `text`.
Query `include_text=true` adds the extracted plain text. By default no raw text is returned.

- Uploads are read in memory, never written to disk, never logged.
- Scanned PDFs without a text layer are rejected.

Response for the demo resume (abridged; real output):

```json
{
  "skills": [{"skill": "Python", "category": "programming",
              "evidence": "Skills Python, SQL, Pandas, Tableau, Microsoft Excel, Statistics, Git Experience Data Analyst, Northwind Retail, 03/2019 to 06/2023 Built weekly SQL and Python reports for the sales leadership team."}, "..."],
  "education": [{"level": "Bachelor", "evidence": "Bachelor of Science in Statistics, Lakeside State University, 2016"}],
  "highest_degree": "Bachelor",
  "experience": {"total_years": 6.33, "source": "dates", "date_ranges_found": 2, "stated_years": null,
                 "statements": ["Data Analyst, Northwind Retail, 03/2019 to 06/2023 Built weekly SQL and Python reports for the sales leadership team.", "..."]},
  "projects": ["Customer churn analysis using logistic regression in Python and scikit-learn."],
  "certifications": ["Tableau Desktop Specialist"],
  "notes": ["Experience years are estimated from employment date ranges ...", "..."],
  "disclaimer": "This system is an academic research prototype ..."
}
```

Skills come from the fixed taxonomy, so aliases apply. For the demo, "logistics" yields Supply Chain
and "variance analysis" yields Financial Analysis. Evidence is the source *sentence*. Line breaks are
collapsed during normalisation, so an unpunctuated list can make one long sentence. The UI should
truncate or wrap evidence strings.

### POST /api/parse-job

Request:

```json
{"job_description": "Senior Data Analyst\n\nResponsibilities\nBuild and maintain dashboards ..."}
```

Response (abridged; real output for the demo job):

```json
{
  "title": "Senior Data Analyst",
  "required_skills": [{"skill": "AWS", "evidence": "Must have AWS experience."}, "..."],
  "preferred_skills": [{"skill": "Airflow", "evidence": "Preferred Qualifications Experience with Airflow and Snowflake is a plus."}, "..."],
  "uncertain_skills": [{"skill": "Data Visualization", "evidence": "Senior Data Analyst Responsibilities Build and maintain dashboards that track sales and operational performance."}],
  "experience_requirement": {"min_years": 5.0, "max_years": null, "preferred_years": null,
                             "evidence": ["5+ years of experience in data analysis."]},
  "education": {"required_level": "Bachelor", "preferred_level": null},
  "responsibilities": ["Build and maintain dashboards that track sales and operational performance.", "..."],
  "responsibilities_from_section": true
}
```

`title` is a heuristic (the first short line) and is not used by any model. In "Tableau or Power BI"
both skills are marked required, because alternatives are not modelled.

### POST /api/match

Request:

```json
{"resume": "Summary\nData analyst ...", "job_description": "Senior Data Analyst ...", "model": "hybrid"}
```

Hybrid response for the demo pair (real output, abridged):

```json
{
  "model": "hybrid",
  "score": 0.879478,
  "category": "Strong match",
  "thresholds": [0.51834, 0.664216],
  "validation_percentile": 98.1,
  "components": {"semantic_score": 1.0, "required_skill_coverage": 0.5714, "preferred_skill_coverage": 0.0,
                 "experience_match": 1.0, "responsibility_similarity": 0.9376},
  "matched_required_skills": ["Python", "SQL", "Statistics", "Tableau"],
  "missing_required_skills": ["AWS", "Data Analysis", "Power BI"],
  "matched_preferred_skills": [],
  "missing_preferred_skills": ["Airflow", "Snowflake"],
  "experience": {"candidate_years": 6.33, "source": "dates", "required_years": 5.0, "gap_years": 0.0,
                 "requirement_evidence": ["5+ years of experience in data analysis."]},
  "responsibility_similarity": 0.9376,
  "explanation": {
    "summary": "Weighted average of the available components ...",
    "weights": {"semantic_similarity": 0.6, "required_skill_coverage": 0.15, "preferred_skill_coverage": 0.05,
                "experience_match": 0.1, "responsibility_similarity": 0.1},
    "components_used": ["semantic_similarity", "required_skill_coverage", "preferred_skill_coverage",
                        "experience_match", "responsibility_similarity"],
    "strengths": ["Meets the experience requirement (6.3 vs 5 years)", "..."],
    "gaps": ["4 of 7 required skills found; missing: AWS, Data Analysis, Power BI"],
    "skill_evidence": {"Python": "Skills Python, SQL, Pandas, ... Built weekly SQL and Python reports for the sales leadership team.", "...": "..."},
    "requirement_evidence": {"AWS": "Must have AWS experience.", "...": "..."},
    "responsibility_evidence": [{"job_responsibility": "Build and maintain dashboards that track sales and operational performance.",
                                 "candidate_experience": "Created Tableau dashboards that track revenue, returns and inventory across 40 stores.",
                                 "similarity": 0.7462}],
    "education": {"candidate_level": 3, "required_level": 3}
  },
  "disclaimer": "This system is an academic research prototype ..."
}
```

- `components` holds 0–1 values (semantic and responsibility scaled with the frozen validation
  bounds). A component is `null` when it was not measurable and is left out of `components_used`.
- "Statistics" counts as a matched required skill here because the job says "degree in Statistics":
  the taxonomy does not separate a degree field from a skill.

TF-IDF and semantic responses contain only the common fields plus their own `components` and
`explanation`. There are no skill or experience fields for them. TF-IDF adds the
`explanation.top_shared_terms` that contribute most to the cosine:

```json
{"model": "tfidf", "score": 0.162844, "category": "Strong match", "validation_percentile": 100.0,
 "thresholds": [0.036226, 0.045507], "components": {"tfidf_similarity": 0.162844},
 "explanation": {"summary": "...", "top_shared_terms": [{"term": "statistics", "contribution": 0.02375},
                 {"term": "and python", "contribution": 0.021929}, "..."], "limitations": "Lexical only: ..."}}
```

### POST /api/compare

Same request without `model`. Returns `tfidf`, `semantic`, `hybrid` (each a full `/api/match`
result) plus:

```json
{"ranking": [{"model": "semantic", "score": 0.812254, "category": "Strong match", "validation_percentile": 100.0},
             {"model": "tfidf", "score": 0.162844, "category": "Strong match", "validation_percentile": 100.0},
             {"model": "hybrid", "score": 0.879478, "category": "Strong match", "validation_percentile": 98.1}],
 "note": "These are model scores on different scales, not calibrated probabilities. ..."}
```

## Errors

Every error has the same shape and never contains the submitted text or a stack trace:

```json
{"error": {"code": "INVALID_INPUT", "message": "resume: Resume text cannot be empty."}}
```

| HTTP | `code` | When |
|---|---|---|
| 422 | `INVALID_INPUT` | missing/empty resume or job text, unknown `model`, malformed JSON, no file and no text |
| 422 | `UNSUPPORTED_OR_UNREADABLE_FILE` | extension not PDF/DOCX/TXT, corrupted or encrypted file, no extractable text |
| 413 | `FILE_TOO_LARGE` | upload above `RJM_MAX_UPLOAD_MB` |
| 413 | `TEXT_TOO_LONG` | text above `RJM_MAX_TEXT_CHARS` |
| 404 | `NOT_FOUND` | unknown path |
| 503 | `MODEL_UNAVAILABLE` | TF-IDF artifact and training data both missing |
| 500 | `INTERNAL_ERROR` | anything unexpected (message is generic) |

## Privacy

- **Logs:** application logs contain only method, path, status and duration. They never contain
  bodies, file names, resume/job text, e-mails or phone numbers, and a test checks this with canary
  strings.
- **Uploads:** processed in memory and discarded.
- **Per request:** each request builds fresh matcher objects around the shared model, so no
  resume text or embedding is kept after the response.
- **Features:** no protected attributes are extracted or used.

## Model loading and latency

- **Loading:** BGE is loaded **once** at startup and shared by the semantic model and the hybrid,
  and TF-IDF is loaded from its artifact. Weights, scaling bounds and thresholds are read from
  committed files; nothing is refitted.
- **Measured on CPU** (8 threads, no GPU), demo texts, real models:

| Measurement | Time |
|---|---|
| Cold start (load TF-IDF + BGE) | 10.5 s |
| Warm `/api/match` (hybrid) | 0.42 s |
| Warm `/api/compare` (all three) | 0.64 s |

- **Fidelity:** an opt-in integration test (`RUN_INTEGRATION=1 pytest -m integration tests/test_api.py`)
  confirms that `/api/compare` reproduces the committed research test-set scores of all three models
  (to within 1e-5; BGE batch composition causes ~1e-7 differences).
