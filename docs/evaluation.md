# Evaluation

All numbers in this document come from files in `results/`; nothing was typed by hand.
Scores are similarities, never probabilities, and cosine similarity is never called "accuracy".

## 1. Experimental question

> Does a skill-aware hybrid model provide a more effective and explainable resume–job matching
> system than lexical TF-IDF and pure semantic matching?

The answer is split into four kinds of evidence: **performance** (held-out metrics),
**robustness** (repeated independent splits), **statistical** (job-level bootstrap intervals) and
**explainability** (do explanations tell the truth about the model?).

## 2. Dataset

`cnamuangtoun/resume-job-description-fit`, pinned revision `08978e2`. Pairs are labelled
No Fit / Potential Fit / Good Fit. After cleaning, 7,987 pairs remain, built from only **643 unique
resumes and 351 unique jobs**. Details are in [dataset.md](dataset.md).

## 3. Leakage prevention

- **The original Hugging Face split is not used:** 476 of its 477 test resumes also appear in its
  train split.
- **Grouping:** resumes are identified by a text hash, and near-duplicates (TF-IDF cosine ≥ 0.9)
  are merged into a `resume_group`. All splits are grouped by `resume_group`, and
  `ml/evaluation/leakage_check.py` checks that resume IDs, groups and normalised resume text never
  cross splits. This check passes for the original split and for every repeated split.
- **Fitting:** anything learned is fitted on train (TF-IDF vocabulary and IDF) or on validation
  (classification thresholds, hybrid scaling bounds, hybrid weights). The test set is scored once,
  after every choice is frozen. The weight-selection script cannot open `test.csv`, and a unit test
  enforces this.
- **Jobs do repeat across splits.** We split by candidate, so the task is ranking *unseen
  candidates* for known job ads.

## 4. Splitting methodology

| Split design | Purpose | Train / val / test | Rankable test jobs |
|---|---|---|---|
| **Original** (Phase 2): `GroupShuffleSplit`, seed 42 | main experiment, Phases 3–5 | 5,537 / 1,259 / 1,191 pairs | 157 |
| **Repeated** (Phase 6): 20 `StratifiedGroupKFold` folds (seed 2026); repetition r tests on folds 3r..3r+2, validates on the next 3, trains on the other 14 | robustness | ≈70 / 15 / 15% | 141–178 per repetition (809 in total) |

The repeated test sets are **disjoint**: each resume is tested at most once across the 5
repetitions. Folds are stratified by label as far as grouping allows. A rankable job is one with
at least 2 candidates and at least 2 different labels.

## 5. Models

| Model | Role | What is learned, and from where |
|---|---|---|
| Random ordering | chance reference | nothing (mean of 200 seeded shuffles) |
| `TFIDF_BASELINE` | traditional baseline | vocabulary and IDF from train |
| `SEMANTIC_BASELINE` (BGE `bge-base-en-v1.5`, zero-shot) | AI approach | nothing; first 512 tokens (chosen on validation) |
| `SKILL_AWARE_HYBRID` | **student innovation** | scaling bounds and one of 6 pre-declared weightings, from validation |

Every model's classification thresholds are learned on validation. See [algorithms.md](algorithms.md).

## 6. Metrics, and why ranking comes first

Matching is used to **order candidates for a job**: a recruiter reads the top of the list. Ranking
metrics measure exactly that, per job, and are the **primary** results:

- **NDCG@5 / NDCG@10**: graded relevance (No = 0, Potential = 1, Good = 2), with credit
  discounted further down the list.
- **MRR**: 1 / rank of the first relevant candidate.
- **MAP**: average precision over all relevant candidates.
- **P@1 / P@5**: share of relevant candidates in the top 1 or 5.

For MRR, MAP and P@k, **relevant = label > 0**. Jobs whose candidates are all relevant are
counted but excluded from those metrics, since every ordering would score the same.

Classification (Accuracy, macro Precision, Recall, F1) is **secondary**. A similarity score is
turned into three classes with two validation-chosen thresholds. That is a post-hoc conversion,
and accuracy rewards predicting the majority class: always answering "No Fit" gets 0.544 test
accuracy, more than TF-IDF's 0.436.

## 7. Baselines (original split)

| Test | MRR | MAP | NDCG@5 | NDCG@10 | P@1 | P@5 | Accuracy | Macro F1 |
|---|---|---|---|---|---|---|---|---|
| Random ordering | 0.7141 | 0.6670 | 0.6944 | 0.7582 | 0.5121 | 0.5116 | — | — |
| TF-IDF | 0.7638 | 0.7179 | 0.7249 | 0.7945 | 0.5974 | 0.5079 | 0.4358 | 0.3938 |
| BGE semantic | 0.7870 | 0.7531 | 0.7653 | 0.8231 | 0.6494 | 0.5339 | 0.4769 | 0.4226 |
| Hybrid (Phase 5) | **0.8341** | **0.7848** | **0.7997** | **0.8459** | **0.7013** | **0.5508** | **0.5113** | **0.4386** |
| Hybrid (Phase 6 parser fix) | 0.8276 | 0.7803 | 0.7948 | 0.8419 | 0.6883 | 0.5495 | 0.5113 | 0.4385 |

| Validation | MRR | NDCG@10 | Macro F1 |
|---|---|---|---|
| Random ordering | 0.7226 | 0.7674 | — |
| TF-IDF | 0.7532 | 0.7934 | 0.4020 |
| BGE semantic | **0.7729** | **0.8114** | 0.4133 |
| Hybrid (Phase 5) | 0.7705 | 0.8085 | 0.4240 |
| Hybrid (parser fix) | 0.7705 | 0.8093 | **0.4257** |

Full table: `results/final_model_comparison.csv` (plus metadata in `.json`).

## 8. Weight selection

Six hybrid weightings were declared before any result. On validation only, the one with the
highest NDCG@10 is chosen (ties go to the first listed).
- **Original split:** `B_semantic_heavy` (semantic 0.60, required 0.15, preferred 0.05,
  experience 0.10, responsibilities 0.10), under both the Phase 5 and the fixed parser.
- **Repeated splits:** the choice is re-made in every repetition. It was `E_experience_heavy` 3
  times, `B_semantic_heavy` once and `D_skill_heavy` once
  (`results/repeated_grouped_selection.csv`). **The best weighting is not stable across samples.**

## 9. Ablation methodology and results

Stages: semantic only → + required skills → + preferred skills → + experience →
+ responsibilities (the initial weights restricted to those parts, renormalised) → final selected
weights.
- **Original split:** the validation ablation was part of the protocol. The test ablation was run
  after freezing, as a report only.
- **Repeated splits:** each stage is evaluated in every repetition, with thresholds from that
  repetition's validation (`results/final_ablation.csv`).

| NDCG@10 | Phase 5 val | Phase 5 test | Repeated mean ± SD (5) |
|---|---|---|---|
| Semantic only | **0.8114** | 0.8231 | 0.8324 ± 0.0236 |
| + Required skills | 0.8094 | 0.8177 | 0.8251 ± 0.0274 |
| + Preferred skills | 0.8041 | 0.8178 | 0.8265 ± 0.0273 |
| + Experience | 0.8060 | 0.8335 | 0.8350 ± 0.0249 |
| + Responsibilities | 0.8010 | 0.8411 | 0.8352 ± 0.0310 |
| Final weighted hybrid | 0.8085 | **0.8459** | **0.8425 ± 0.0217** |

The repeated "semantic only" stage (0.8324) differs slightly from the BGE model itself (0.8322):
the stage passes through the hybrid's validation-fitted clipping, which creates ties at the extremes.
On the original split the two are identical.

**Components are not individually guaranteed to improve ranking.**
- **Required-skill coverage lowers NDCG@10 in every view** (validation, test, repeated). Its
  value is in the explanations, not the ranking.
- **Experience and responsibility alignment help on test and on average across repetitions**, but
  not on the original validation split.
- **The largest gain comes from choosing the weighting per sample** (the final row), which again
  shows the effects vary across splits.

Figure: `results/figures/hybrid_ablation_ndcg10.png`.

## 10. Repeated grouped evaluation

`python -m ml.evaluation.repeated`; 5 repetitions; everything learned is re-learned per repetition.

| Mean ± SD over 5 test splits | MRR | MAP | NDCG@5 | NDCG@10 | P@1 | P@5 | Macro F1 |
|---|---|---|---|---|---|---|---|
| Random ordering | 0.7265 | 0.6838 | 0.7071 | 0.7732 | 0.5298 | 0.5294 | — |
| TF-IDF | 0.7888 | 0.7499 | 0.7604 | 0.8192 ± 0.0127 | 0.6378 | 0.5459 | 0.4052 |
| BGE semantic | 0.8065 | 0.7709 | 0.7763 | 0.8322 ± 0.0238 | 0.6783 | 0.5495 | **0.4122** |
| Hybrid (parser fix) | **0.8237** | **0.7831** | **0.7889** | **0.8425 ± 0.0217** | **0.7024** | **0.5542** | 0.4062 |

Per repetition (NDCG@10, test):

| Repetition | Random | TF-IDF | BGE | Hybrid | Hybrid weighting |
|---|---|---|---|---|---|
| 0 | 0.7769 | 0.8224 | 0.8413 | **0.8521** | experience-heavy |
| 1 | 0.7771 | 0.8073 | 0.8161 | **0.8389** | experience-heavy |
| 2 | 0.7595 | 0.8045 | 0.8118 | **0.8192** | experience-heavy |
| 3 | 0.7776 | 0.8295 | 0.8697 | **0.8745** | semantic-heavy |
| 4 | 0.7749 | **0.8324** | 0.8219 | 0.8279 | skill-heavy |

In repetition 4, TF-IDF is the best of the three models. The random reference is computed on each
repetition's own test jobs, so every comparison uses the same population.
Figures: `results/figures/repeated_ndcg10_distribution.png`, `ndcg10_by_model.png`, `mrr_by_model.png`.

## 11. Statistical analysis

**Unit of resampling: the job.** Ranking metrics are computed per job, and candidates within a job
are not independent, so candidate rows are never resampled.

- **Original test split** (`results/significance_test.csv`): paired bootstrap over the 157
  (or 154 for MRR/MAP) test jobs, with 10,000 resamples and seed 42.
- **Repeated splits** (`results/repeated_grouped_differences.csv`): for each pair of models, the
  per-job difference is computed in every repetition. A *stratified* bootstrap resamples jobs with
  replacement within each repetition's test set (10,000 resamples), and the CI is for the mean over
  repetitions of those per-repetition mean differences. Because the repetitions' test sets are
  disjoint, their jobs are independent units: 809 job units for NDCG, 788 for MRR/MAP.

"Significant" below means the 95% CI excludes 0. No multiple-comparison correction is applied
(12 comparisons per design).

| Difference | Original test: mean [95% CI] | Repeated: mean [95% CI] | Repetitions > 0 |
|---|---|---|---|
| Hybrid − BGE, NDCG@10 | +0.023 [+0.007, +0.039] | **+0.010 [+0.002, +0.019]** | **5 / 5** |
| Hybrid − BGE, MRR | +0.047 [+0.015, +0.080] | +0.017 [+0.001, +0.034] | 5 / 5 |
| Hybrid − BGE, MAP | +0.032 [+0.012, +0.052] | +0.012 [+0.001, +0.023] | 5 / 5 |
| Hybrid − BGE, NDCG@5 | +0.034 [+0.017, +0.053] | +0.013 [+0.003, +0.023] | 5 / 5 |
| Hybrid − TF-IDF, NDCG@10 | +0.051 [+0.026, +0.078] | +0.023 [+0.012, +0.035] | 4 / 5 |
| Hybrid − TF-IDF, MRR | +0.070 [+0.025, +0.116] | +0.035 [+0.015, +0.055] | 5 / 5 |
| BGE − TF-IDF, NDCG@10 | +0.029 [+0.001, +0.056] | +0.013 [+0.002, +0.024] | 4 / 5 |
| BGE − TF-IDF, MRR | +0.023 [−0.025, +0.072] | +0.018 [−0.003, +0.039] | 4 / 5 |
| *Hybrid − BGE, NDCG@10, original **validation*** | −0.003 [−0.018, +0.012] | | |

Reading this table:
- **The hybrid's ranking lead over BGE is real but small.** It is positive in every repetition,
  and its repeated-split CI excludes 0, but the size (+0.010 NDCG@10) is less than half of the
  original test estimate (+0.023). The single test split was a favourable sample.
- **One split disagrees:** the original validation split shows no difference.
- **For classification the picture reverses:** across repetitions the hybrid's mean macro F1
  (0.406) is *below* BGE's (0.412).
- **BGE over TF-IDF:** significant for NDCG@10 in both designs, but not for MRR.

Figure: `results/figures/repeated_paired_differences.png`.

## 12. Error analysis

`results/error_analysis.csv` and `error_analysis_summary.csv` cover the original test split
(saved Phase 3–5 predictions). Each of the 154 binary-eligible jobs is classified by whether each
model's top-ranked candidate is relevant (P@1). Example jobs are fixed in advance as the first 3 of
each category in job_id order, chosen without looking at which model wins. Tags are rules over
structured features; no text is stored.

| Category | Jobs | Share | Most frequent diagnostic tags |
|---|---|---|---|
| A: TF-IDF right, BGE wrong | 17 | 11% | missing required skill (11), semantic similarity despite missing requirement (11), generic job boilerplate (10) |
| B: BGE right, TF-IDF wrong | 25 | 16% | missing required skill (18), experience mismatch (18), terminology mismatch (16) |
| C: Hybrid right, BGE wrong | 14 | 9% | missing required skill (13), semantic similarity despite missing requirement (13) |
| D: BGE right, Hybrid wrong | 6 | 4% | experience mismatch (5), missing required skill (4), terminology mismatch (4) |
| E: all three wrong | 30 | **19%** | missing required skill (24), semantic similarity despite missing requirement (24), generic boilerplate (20), responsibility mismatch (19) |

What the categories show:
- **C vs D (14 vs 6)** shows where the hybrid helps: its wins are mostly jobs where BGE
  top-ranked a semantically similar candidate missing a required skill.
- **B** shows terminology mismatch, where wording differs but meaning matches, as TF-IDF's
  characteristic failure.
- **E, the largest category**, is where every model put a non-relevant candidate first. Usually
  that candidate looks similar and still lacks a required skill. Duties often come from a generic
  ad without a responsibilities section, which suggests limits in the labels and the job texts that
  no similarity score fixes.

## 13. Explainability evaluation

`python -m ml.evaluation.explainability_check` checks the frozen Phase 5 hybrid's explanation for
**every one of the 1,191 test pairs** against independently recomputed facts
(`results/hybrid_explainability_check.json`):

| Property | Pairs passing |
|---|---|
| Reported missing skills are absent from the resume (fresh extraction) | 1,191 / 1,191 |
| Reported matched skills are present, and required/preferred in the job | 1,191 / 1,191 |
| Matched + missing = exactly the job's required (preferred) skills | 1,191 / 1,191 |
| Experience gap = max(0, required − candidate years) | 1,191 / 1,191 |
| Responsibility evidence sentences occur in the resume and the job | 1,191 / 1,191 |
| Skill evidence sentences occur in the resume | 1,191 / 1,191 |
| Score = Σ w·component / Σ w over the components reported as used | 1,191 / 1,191 |
| Score = the score saved in the test prediction file | 1,191 / 1,191 |

The same checker also runs as a unit test on synthetic pairs, and it detects a wrong saved score.
This shows the explanations are **faithful to the model**. It does **not** show they are correct
about the person: an extraction error (e.g. a missed skill alias) would be faithfully reported as a
missing skill.

## 14. Parser fix (Phase 6) and historical results

The documented miss "RequiredSQL Experience8" is a general rule failure: requirement cues glued
to the next word are invisible to `\b`. About 20 glued cues occur in train job descriptions. The
general fix, glue-aware cue boundaries (the same rule the skill matcher uses), changes 7 of 2,297
train skill statuses. It sits behind the `glued_cues` option:
- **Phase 5 configuration** (`hybrid.json`) keeps the old behaviour. Re-running it at HEAD
  reproduced the committed predictions byte-for-byte.
- **Corrected experiment** (`hybrid_parserfix.json`) has its own weights and result files.

Effect: validation NDCG@10 0.8085 → 0.8093, test 0.8459 → 0.8419, macro F1 unchanged (0.4386 /
0.4385). The impact is negligible, and the hybrid's test lead over BGE does not depend on the
parser quirk. The repeated evaluation uses the corrected parser.

## 15. Privacy

`python -m ml.evaluation.privacy_check` scans every CSV/JSON in `results/` and `config/`. It looks
for e-mail addresses, phone numbers, URLs, raw-text or protected-attribute columns, and any text
cell longer than 120 characters. **Result: PASS**, with no findings. Prediction and analysis files
contain only IDs, labels, scores, counts and numeric features. No model uses name, age, gender,
race, religion, nationality, marital status, photo or address.

## 16. Reproducibility

- **Seeds and pins:** fixed seeds throughout (split 42, repeated folds 2026, bootstrap 42), a pinned
  dataset revision, a pinned BGE revision, and `requirements.lock`.
- **Phase 5:** re-runs reproduce the frozen weights, ablations and predictions byte-for-byte.
- **Repeated evaluation:** re-run once, with every output file compared (see the Phase 6 commit
  message).
- **Commands:**

```bash
python -m ml.evaluation.experiment hybrid_parserfix
python -m ml.evaluation.repeated
python -m ml.evaluation.significance tfidf semantic hybrid
python -m ml.evaluation.error_analysis
python -m ml.evaluation.explainability_check hybrid
python -m ml.evaluation.privacy_check
python -m ml.evaluation.final_report
```

## 17. Limitations

- **Small data:** 643 resumes and 351 jobs from one public dataset, whose labelling process is
  undocumented. Generalisation beyond this dataset is untested.
- **Small effect:** the hybrid's advantage over BGE is about +0.01 NDCG@10 across splits. It is
  statistically detectable but practically modest.
- **Weights:** the best weighting changes between samples. The hand-declared linear weightings
  are a coarse search, and learned weights have not been tried.
- **Classification:** the classification gain seen on the original split does not hold on average.
- **Extraction:** errors remain (taxonomy coverage, approximate experience dates, glued text). The
  explanations faithfully reflect these errors.
- **Statistics:** no multiple-comparison correction. The bootstrap treats jobs within a repetition
  as independent, although the same job ad can appear (with different candidates) in different
  repetitions.

## 18. Final conclusions

**CONFIRMED** (consistent across the original split and the 5 repeated splits):
- **TF-IDF provides a lexical signal:** it beats random ordering on every ranking metric except
  P@5 on the original split, and on all six in repeated splits.
- **BGE improves over TF-IDF** on the original held-out test (NDCG@10 0.8231 vs 0.7945) and on
  average across repetitions (0.8322 vs 0.8192, CI excludes 0). It is not better in every
  repetition (4 of 5) and not significant for MRR.
- **The hybrid is the best model on the original held-out test** (NDCG@10 0.8459, MRR 0.8341).
- **Across 5 independent grouped splits, with the whole method re-run each time, the hybrid ranks
  better than BGE in every split.** The mean NDCG@10 gain is +0.010 [+0.002, +0.019].
- **The hybrid gives structured explanations** (matched and missing skills, experience gap,
  duty ↔ experience evidence) that were verified faithful to its features on all 1,191 test pairs.

**NOT YET CONCLUSIVE:**
- **Whether the hybrid's advantage is large enough to matter.** It is consistent but small, it is
  smaller than the original test split suggested, and it did not show up on the original
  validation split.
- **Whether individual features generalise.** Required-skill coverage does not improve ranking in
  any view. Experience and responsibility effects vary by split, and the selected weighting changes
  from split to split.
- **Whether the hybrid improves classification:** yes on the original split, no on average across
  repetitions.
- **Whether any of this generalises beyond this dataset** of 643 resumes and 351 jobs.
