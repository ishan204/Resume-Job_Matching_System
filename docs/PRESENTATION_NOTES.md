# Presentation notes

Deck: `docs/Resume_Job_Matching_Final_Presentation.pptx` (15 slides, speaker notes on every slide).
Every number below comes from `results/` and is the same number on the slide. Before presenting,
fill in the title-slide placeholders (name, roll number, course, supervisor, institute).

## Slide by slide

| # | Slide | Purpose | Numbers to know |
|---|---|---|---|
| 1 | Title | Topic, three approaches, disclaimer | — |
| 2 | Problem | Lexical misses meaning; semantic misses requirements | AWS example is an **illustration**, not a result |
| 3 | Research question | RQ, 4 objectives, H0/H1 | — |
| 4 | System overview | Pipeline from dataset to UI; tech stack | — |
| 5 | Dataset | Scale and why grouping is needed | 8,000 raw → 7,987 pairs; 643 resumes; 351 jobs; split 5,537 / 1,259 / 1,191; 593 groups (50 near-duplicates merged); labels 3,993 / 1,998 / 1,996; 157 rankable test jobs |
| 6 | Leakage | Original split is invalid | 476 of 477 original test resumes in train (99.79%); our splits: 0 overlap |
| 7 | Three approaches | TF-IDF, BGE, hybrid; same protocol | BGE `bge-base-en-v1.5`, revision a5beb1e, first 512 tokens |
| 8 | Student-designed improvement | Skill-Aware Hybrid formula and weights | 0.60 / 0.15 / 0.05 / 0.10 / 0.10; best of 6 pre-declared sets on validation (0.8093) |
| 9 | Test results | Ranking first, classification second | NDCG@10: random 0.7582, TF-IDF 0.7945, BGE 0.8231, hybrid 0.8419; macro F1 0.3938 / 0.4226 / 0.4385; validation: hybrid 0.8093 < BGE 0.8114 |
| 10 | Robustness | 5 grouped splits settle the mixed evidence | Mean NDCG@10 0.8425 ± 0.0217 vs BGE 0.8322 ± 0.0238; Δ +0.0104 [+0.0017, +0.0194], 5/5 splits; MRR Δ +0.0172 [+0.0009, +0.0338]; macro F1 BGE 0.4122 > hybrid 0.4062 |
| 11 | Ablation + errors | Which parts help, where the hybrid helps | Ablation 0.8324 → 0.8251 → 0.8265 → 0.8350 → 0.8352 → 0.8425; hybrid fixes 14 BGE errors (13 missing-requirement), introduces 6; 30 jobs (19.5%) all wrong |
| 12 | Explainability | What an explanation contains, faithfulness check | 8 checks × 1,191 test pairs, all pass |
| 13 | Working application | Real screenshots, demo flow, API/privacy | Demo pair: hybrid 0.879, 4 of 7 required skills, missing AWS / Data Analysis / Power BI |
| 14 | Conclusion | Supported vs not established, RQ answer | — |
| 15 | Viva points | Six topics + takeaway; notes hold the rubric map | — |

## Viva points

- **Leakage:** 643 resumes produce 7,987 pairs, so a row-level split puts the same resume in train and test. We split by resume group. Jobs repeat across splits by design: the task is ranking *unseen candidates* for a job.
- **Ranking vs classification:** NDCG, MRR and MAP score the order of candidates per job; macro F1 converts scores to 3 classes with validation thresholds. Accuracy isn't the headline because always predicting "No Fit" scores 0.5441.
- **No tuning on test:** the weights, scaling bounds, thresholds and truncate-vs-chunk choice all come from validation. Test is scored once.
- **Why 0.60 semantic?** It was the best of 6 pre-declared sets on validation. In the repeated splits the method re-selected weights per split (experience-heavy ×3, semantic-heavy, skill-heavy). So the robustness result tests the *method*, not the fixed weights.
- **Missing ≠ zero:** a component the job doesn't specify is left out and the remaining weights are renormalised.
- **Served vs Phase 5 hybrid:** the served model includes a general parser fix ("RequiredSQL"). Its test NDCG@10 is 0.8419; the Phase 5 hybrid scored 0.8459. The error analysis and explainability check ran on the Phase 5 hybrid, with the same explanation code.
- **Bootstrap CI:** resamples jobs, not rows, within each split. No multiple-comparison correction.
- **Real example (Phase 5, docs/algorithms.md):** job 77f71b61c082. BGE ranked first a No-Fit candidate who was missing "Agile"; the hybrid moved them to #4 and a Good-Fit candidate from #3 to #1.

## Limitations — do not forget to say these

1. The gain is **small** (+0.0104 NDCG@10). It did **not** appear on the original validation split.
2. **Classification is not improved:** BGE has the best mean macro F1.
3. **Required-skill coverage alone lowers ranking** (−0.0073 in the ablation); its value is explanatory.
4. In repeated split 5, TF-IDF beats both BGE and the hybrid.
5. One dataset, 643 resumes / 351 jobs; how it was labelled is undocumented.
6. Faithfulness ≠ correctness: rule-based extraction makes errors (for example, "Tableau or Power BI" marks both as required, and "Statistics" as a degree can be read as a skill). Experience years are approximate.
7. BGE reads only the first 512 tokens, so about 58–60% of resume text is never seen.
8. "Skill-Aware Hybrid" is a **student-designed improvement**, not a novel research algorithm. The scores are not probabilities and must not be the sole basis for hiring decisions.

## Rubric mapping

| Criterion | Slides |
|---|---|
| Problem formulation / originality | 2, 3 |
| AI concepts / algorithm implementation | 4, 7, 8 |
| Comparison of AI approaches | 9, 10 |
| Dataset / experimentation | 5, 6, 10 |
| Evaluation / interpretation | 9, 10, 11, 14 |
| Student improvement | 8, 11, 12 |
| Working application / demo | 12, 13 (+ live demo) |
| Viva | 15, speaker notes, this file |

Live demo: `uvicorn backend.app.main:app --port 8000` (models load in ~10–30 s), then `npm --prefix frontend run dev`. In the app: Match Analysis → Load Demo → Analyze → Compare Models → Research.
