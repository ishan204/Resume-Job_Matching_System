# Dataset

All numbers below were produced by running the pipeline (2026-10-05) and can be regenerated with:

```bash
python -m ml.dataset.download          # data/raw/{train,test}.parquet
python -m ml.dataset.prepare           # data/processed/all.parquet, results/prepare_report.json
python -m ml.dataset.validate          # schema/invariant checks
python -m ml.dataset.split             # data/splits/{train,validation,test}.csv, split_summary.json
python -m ml.dataset.validate          # re-validates the split files
python -m ml.evaluation.leakage_check  # results/dataset_stats.json, prints LEAKAGE CHECK: PASS/FAIL
```

## Source and version

- Hugging Face: [`cnamuangtoun/resume-job-description-fit`](https://huggingface.co/datasets/cnamuangtoun/resume-job-description-fit)
- Pinned revision: `08978e21714984bb417547d2c0f9b477f5298163` (set in `ml/config.py`)
- Original splits: train 6,241 rows + test 1,759 rows = **8,000 rows**
- The raw data is not committed to Git (`data/` is git-ignored).

## Schema and label distribution

Raw columns (all strings, 0 nulls): `resume_text`, `job_description_text`, `label`.
Renamed to `resume`, `job_description`, `label`; the pipeline adds `original_split`, `resume_id`,
`job_id`, `resume_group`, `label_id` (No Fit = 0, Potential Fit = 1, Good Fit = 2).

| Label | Raw (8,000) | Cleaned (7,987) |
|---|---|---|
| No Fit | 4,000 | 3,993 (50.0%) |
| Potential Fit | 2,000 | 1,998 (25.0%) |
| Good Fit | 2,000 | 1,996 (25.0%) |

## Cleaning and duplicates

Cleaning: Unicode NFKC normalisation and whitespace collapsing; case and wording are preserved
(models do their own lower-casing). Labels are normalised to the three canonical strings.

| Finding | Value |
|---|---|
| Original rows | 8,000 |
| Empty / invalid records dropped | 0 |
| Repeated (resume, job) pairs | 7 pairs (14 rows) |
| — exact duplicates (same label) dropped | 1 row |
| — pairs with conflicting labels, all copies dropped | 6 pairs (12 rows) |
| **Cleaned rows** | **7,987** |
| Unique resumes (exact normalised text) | 643 |
| Unique job descriptions | 351 |
| Resumes appearing in more than one pair | 619 of 643 |
| Jobs appearing in more than one pair | 348 of 351 |
| Pairs per resume (min / median / max) | 1 / 7 / 82 |
| Pairs per job (min / median / max) | 1 / 16 / 111 |

Conflicting pairs are dropped rather than resolved because there is no principled way to pick the
correct label.

**Key observation:** the 8,000 pairs are built from only 643 resumes and 351 jobs. Each resume is
reused across many jobs, so a split that ignores resume identity would leak heavily.
The dataset's own split does exactly that: **476 of the 477 resumes in the original test split also
appear in the original train split.** We therefore do not use it.

## Resume identity and grouping

The dataset has no resume or job IDs, so they are derived:

- `resume_id` / `job_id` = first 12 hex chars of SHA-1 of the lower-cased cleaned text.
- `resume_group` = connected components of the graph linking resumes whose TF-IDF cosine
  similarity is ≥ 0.9. This keeps lightly edited copies of the same resume together.

Result: 643 resumes → 593 groups (50 resumes merged; 49 groups contain more than one resume;
the largest contains 3). The largest group was inspected manually: it holds three copies of the
same "Big Data Engineer" resume (minimum pairwise cosine 0.893), i.e. a true near-duplicate, not
an over-merge.

## Splits and leakage check

`GroupShuffleSplit` by `resume_group`, seed 42, target 70 / 15 / 15. Because whole groups are
assigned, the row fractions are approximate.

| Split | Rows | Fraction | Unique resumes | Unique jobs | Rankable jobs* |
|---|---|---|---|---|---|
| Train | 5,537 | 69.3% | 450 | 349 | 289 |
| Validation | 1,259 | 15.8% | 97 | 302 | 163 |
| Test | 1,191 | 14.9% | 96 | 289 | 157 |

\*Rankable job = at least 2 candidates in that split with at least 2 different labels.
Only these jobs contribute to ranking metrics.

Label distribution per split:

| Split | No Fit | Potential Fit | Good Fit |
|---|---|---|---|
| Train | 2,705 (48.9%) | 1,467 (26.5%) | 1,365 (24.7%) |
| Validation | 640 (50.8%) | 250 (19.9%) | 369 (29.3%) |
| Test | 648 (54.4%) | 281 (23.6%) | 262 (22.0%) |

The split is grouped, not stratified, so label proportions vary by a few points between splits.

**Leakage check (`ml/evaluation/leakage_check.py`): PASS**

| Overlap | train/val | train/test | val/test |
|---|---|---|---|
| `resume_id` | 0 | 0 | 0 |
| `resume_group` | 0 | 0 | 0 |
| normalised resume text (independent of hashing) | 0 | 0 | 0 |
| `job_id` (allowed — see below) | 300 | 288 | 259 |

Jobs are shared across splits by design: we split by resume, and almost every job is paired with
many resumes. The models must rank *unseen candidates*, which is the realistic task.

**Reproducibility: PASS.** Running `split` twice gave byte-identical files (same SHA-256) and the
same (resume, job) assignment for every split. Re-running `prepare` → `split` from the raw files also
reproduced identical split hashes. `split_summary.json` was checked against the CSV files
(rows, unique resumes/groups/jobs, label counts, SHA-256): all match.

## Limitations

- **Small number of distinct resumes (643) and jobs (351).** Results reflect this pool; the
  validation and test sets each contain under 100 distinct resumes.
- **Shared jobs across splits.** Any model that learns job-specific patterns from train could
  benefit. The Phase 3–5 approaches are similarity-based with only a few weights tuned on
  validation, so the risk is low, but it is a known caveat.
- **Derived identities.** Grouping uses a 0.9 TF-IDF cosine threshold. A rewritten resume
  from the same person below that threshold would be treated as a different candidate.
- **Text quality.** Section headings are glued to the following word in the source text
  (e.g. `SummaryHighly motivated…`). We do not repair this; parsing must tolerate it.
- **Labels.** The labelling procedure is not described by the metadata we retrieved, so label
  quality is unknown. 6 pairs had contradictory labels.
- **Licence / provenance.** The Hugging Face dataset metadata lists no licence. It is used here
  for academic research only and is not redistributed.
