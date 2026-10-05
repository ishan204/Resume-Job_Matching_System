# Student-Designed Improvement: Skill-Aware Hybrid Resume–Job Matching

> **Student innovation:** *Skill-Aware Hybrid Resume–Job Matching* (`SKILL_AWARE_HYBRID`).
> This is a **student-designed system improvement** for this project. It is not claimed as novel
> research at the scientific-community level: hybrid scoring and skill matching are established ideas.
> The contribution is the design, implementation and honest evaluation of this particular combination.

## Why it was needed

| Approach | What it measures | What it cannot see |
|---|---|---|
| TF-IDF (baseline) | **Lexical similarity**: shared words | Synonyms; any notion of a requirement |
| BGE (AI approach) | **Semantic similarity**: related meaning | Whether the candidate *meets* the job's explicit requirements |
| **Hybrid (this work)** | **Semantic + explicit requirement-aware features** | (see Limitations) |

Semantic similarity alone can rank a semantically related candidate highly even when mandatory
requirements are missing. A data engineer without the required AWS experience is still *about*
data engineering. Phase 4 confirmed this: BGE's mean test score is 0.651 for Potential Fit and
0.660 for Good Fit, almost the same, so it measures topic, not fit.

## What the hybrid adds

For every resume–job pair it extracts, deterministically and with evidence (no LLM, no external API):

1. **Required skill coverage**: which of the skills the job marks as required (by sentence wording
   such as "must have" / "required", or by a "Required Qualifications" section) the resume contains.
2. **Preferred skill coverage**: the same for "preferred / nice to have / a plus" skills.
3. **Experience compatibility**: estimated years of experience (from employment date ranges) against
   the job's minimum years, as a graded score.
4. **Responsibility alignment**: each job duty is matched to the most similar sentence from the
   candidate's work history (BGE embeddings), and the matches are averaged.

## Formula and weights

```
hybrid = Σ wᵢ·fᵢ / Σ wᵢ      over the components fᵢ that are available for the pair
```

All components are in [0, 1], so the score is in [0, 1]. A component is **left out** (not set to 0)
when there is nothing to measure, e.g. the job states no years requirement. Missing information is
not evidence of a mismatch.

Six weight sets were declared in `experiments/config/hybrid.json` **before any result was seen**.
They were compared on the **validation** split only, and the rule "highest validation NDCG@10 wins"
selected:

| Semantic | Required skills | Preferred skills | Experience | Responsibilities |
|---|---|---|---|---|
| 0.60 | 0.15 | 0.05 | 0.10 | 0.10 |

These are frozen in `config/matching_weights.json`. The test set was scored once, afterwards.

## Validation via ablation, and the result

Full details: [algorithms.md, Student-Designed Skill-Aware Hybrid](algorithms.md#student-designed-skill-aware-hybrid-skill_aware_hybrid-phase-5).

**Test set (157 rankable jobs):** the hybrid scores best of all approaches on every metric
(NDCG@10 0.8459 vs BGE 0.8231 vs TF-IDF 0.7945; MRR 0.8341 vs 0.7870 vs 0.7638). A paired
bootstrap over jobs gives 95% intervals for hybrid − BGE that exclude 0 on NDCG@10, NDCG@5, MRR
and MAP.

**Validation set (163 rankable jobs):** the same frozen hybrid is *not* better than BGE
(NDCG@10 0.8085 vs 0.8114; bootstrap CI for the difference [−0.018, +0.012]). In the validation
ablation, adding each explicit feature to semantic similarity did not improve NDCG@10.

**Verdict on H0 vs H1.** On the held-out test split, H1 is supported: the improvement over pure
semantic matching is statistically significant. That improvement did **not** replicate on the
equally sized validation split. The per-feature analysis shows that how informative each feature
is changes a lot between two samples of about 96 resumes. Our honest conclusion: **the evidence that
the hybrid beats pure semantic matching is promising but not conclusive.** Classification
(macro F1, accuracy) improved on both splits. Confirming the ranking gain needs repeated grouped
splits (cross-validation), planned for the final experiments.

## Explainability

Unlike a single similarity number, every hybrid score comes with the reasons behind it
(`HybridMatcher.explain()`): matched and missing required/preferred skills with the sentences they
were found in, the experience gap in years, the best-matching duty ↔ experience sentence pairs, and
the components used. All of it comes from extracted values, never generated text.
