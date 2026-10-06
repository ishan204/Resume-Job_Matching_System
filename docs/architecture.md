# Architecture

## System diagram

```
                 Resume (PDF/DOCX/TXT) + Job Description
                                  |
                    ┌─────────────┴─────────────┐
                    v                           v
              Resume Parser                 JD Parser
                    |                           |
                    └─────────────┬─────────────┘
                                  |
          ┌───────────────────────┼───────────────────────┐
          v                       v                       v
   TFIDF_BASELINE        SEMANTIC_BASELINE        Structured features
   (lexical cosine)      (BGE cosine)             (skills, experience,
          |                       |                education, responsibilities)
          |                       └───────────┬───────────┘
          |                                   v
          |                        SKILL_AWARE_HYBRID  ← student innovation
          |                                   |
          └─────────────────┬─────────────────┘
                            v
                 Evaluation engine (same test set)
                            v
                 results/*.csv, *.png
                            v
              FastAPI backend  →  React frontend
```

All paths, the random seed, the pinned dataset revision and the embedding model name live in
`ml/config.py`. Hybrid weights live only in `config/matching_weights.json`.

## ML package

TODO (Phase 5)

## Backend API

TODO (Phase 8)

## Frontend

TODO (Phase 9)
