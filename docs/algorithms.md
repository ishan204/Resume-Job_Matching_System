# Algorithms

_Skeleton — sections are filled as phases complete. Nothing here is a result until stated._

## TF-IDF (`TFIDF_BASELINE`, Phase 3)

Code: `ml/models/tfidf.py` · experiment: `python -m ml.evaluation.experiment tfidf` ·
parameters: `experiments/config/tfidf.json`

### What is it?

TF-IDF (Term Frequency – Inverse Document Frequency) turns a document into a vector with one
dimension per vocabulary term. A term gets a high weight when it is frequent **in this document**
but rare **across the corpus**. Words like "experience" appear everywhere and get a low weight;
"pytorch" is rarer and gets a high weight.

### Why is it a good baseline?

It is the classic information-retrieval method and the core of traditional keyword-based
applicant-tracking systems. It is fast, deterministic, needs no training labels and every score
can be traced back to the shared terms. Any AI approach should beat it to be worth its cost.

### TF component

How often term *t* occurs in document *d*. We use **sublinear TF**: `tf = 1 + log(count)`, so a
word repeated 20 times does not count 20× more than a word used once.

### IDF component

`idf(t) = ln((1 + N) / (1 + df(t))) + 1` (scikit-learn's smoothed form), where *N* is the number of
documents and *df(t)* the number containing *t*. Rare terms → large IDF; common terms → small IDF.

### Building the vector

1. **Preprocess** (`preprocess()`, deterministic, conservative):
   - remove noise characters (the Unicode replacement char `�`, zero-width spaces, bullets);
   - split a fixed list of section headings glued to the next word in this dataset
     (`SkillsPython` → `Skills Python`). A general camel-case split is **not** used because it
     would break `JavaScript` and `PowerPoint`;
   - lowercase; drop sentence-ending full stops but keep internal dots (`node.js`);
   - collapse whitespace.
2. **Tokenise** with a pattern that keeps technical terms: `c++`, `c#`, `node.js`, `asp.net`
   and single letters such as `c` and `r` all survive (sklearn's default pattern would drop them).
3. **Unigrams + bigrams** (`ngram_range = (1, 2)`), so "machine learning" is also one feature.
4. Drop terms in fewer than 2 training documents (`min_df = 2`, typos / one-off names) or in more
   than 95% (`max_df = 0.95`, words that carry no information). No fixed stop-word list is used:
   IDF already down-weights common words, and fixed lists contain words like "it".
5. Weight = TF × IDF; each vector is L2-normalised (length 1).

The fitted vocabulary has 68,545 terms.

### Fitting rule (leakage prevention)

The vocabulary and the IDF statistics are learned from **training text only**: the unique train
resumes plus the unique train job descriptions. Repeated resumes are de-duplicated first so a
resume used in 82 pairs does not count as 82 documents. Validation and test text is only
**transformed** with the already-fitted vectorizer; words that appear only in validation/test are
ignored. A unit test checks that transforming new text leaves the vocabulary unchanged.

## Cosine similarity

`cos(r, j) = (r · j) / (‖r‖ ‖j‖)`: the cosine of the angle between the resume vector *r* and the
job vector *j*. Because TF-IDF weights are non-negative it lies in **[0, 1]**:
1 = same term distribution, 0 = no shared vocabulary terms. Our vectors already have length 1,
so cosine is simply the dot product.

The cosine is the **match score**. It is a *similarity*, not a probability, and not an accuracy.
The model never sees labels when scoring.

### How a resume and a job are compared

`score = cos(TF-IDF(resume), TF-IDF(job description))`, both vectors coming from the same
train-fitted vectorizer. `TFIDFMatcher.score_pair()` returns `{"model": "tfidf", "score": …}`.

### Advantages

- Simple, fast, fully deterministic, needs no labelled data.
- Explainable: the score is driven by identifiable shared terms.
- Rewards exact matches of rare, specific terms (e.g. a named framework).

### Limitations

- **Lexical only.** It matches *words*, not *meaning*. "Built REST services in Flask" and
  "backend API development" share almost no terms and score near 0, even though they describe the
  same work. Synonyms and abbreviations (ML vs. machine learning) are not linked.
- No notion of *required* vs *preferred*: every shared term counts, including boilerplate
  ("team player", company descriptions).
- Long, varied resumes produce low absolute scores (observed range on test: 0.0007 – 0.112), so
  the raw number is hard to interpret on its own.
- Unseen vocabulary in new text is ignored.

These limitations motivate the semantic transformer baseline (Phase 4), which compares meaning
rather than vocabulary.

## Evaluation protocol (shared by all models)

Code: `ml/evaluation/experiment.py`, `ml/evaluation/metrics.py`.

1. Fit the model on **train** only.
2. Score **validation**; learn classification thresholds on validation labels.
3. Freeze everything; score **test** once.

**Ranking.** For each job in a split, its candidate resumes are sorted by score (ties broken by
`resume_id` for determinism) and compared with the true labels.
- Graded relevance for NDCG: No Fit = 0, Potential Fit = 1, Good Fit = 2 (linear gain,
  log2 discount — the same definition as `sklearn.metrics.ndcg_score`).
- Binary relevance for MRR, MAP, P@k: **relevant = label > 0** (Potential Fit or Good Fit).
- Eligible jobs (Phase 2 definition): ≥ 2 candidates and ≥ 2 distinct labels. Excluded jobs are
  counted by reason (single candidate / single label).
- MRR, MAP and P@k are averaged over eligible jobs that contain at least one relevant **and** one
  non-relevant candidate; otherwise every ordering scores the same. These "binary-trivial" jobs are
  counted, not hidden.
- P@k = relevant candidates in the top k / min(k, number of candidates).

**Classification (secondary).** A cosine score is not a classifier. To report classification
metrics we convert scores to labels with two thresholds: `score < t1` → No Fit,
`t1 ≤ score < t2` → Potential Fit, `score ≥ t2` → Good Fit. The thresholds are chosen on the
**validation set only**: every pair of the 1st–99th score percentiles is tried and the pair with the
highest macro F1 is kept. They are then frozen and applied to test. A unit test confirms that
changing test labels does not change the thresholds.

**Chance-level references.** Every metrics file also records what a model with no signal would
score on the same jobs: the mean of 200 seeded random orderings, and always predicting No Fit.

### TF-IDF results (executed 2026-10-05)

Source: `results/tfidf_{validation,test}_metrics.json`. Reproducibility: two full runs produced
byte-identical prediction and metrics files.

| | Validation | Test | Test, random ordering |
|---|---|---|---|
| Pairs scored | 1,259 | 1,191 | |
| Jobs (total / eligible) | 302 / 163 | 289 / 157 | |
| Excluded: single candidate / single label | 73 / 66 | 85 / 47 | |
| Binary-eligible jobs (MRR/MAP/P@k) | 161 | 154 | |
| MRR | 0.7532 | 0.7638 | 0.7141 |
| MAP | 0.7182 | 0.7179 | 0.6670 |
| NDCG@5 | 0.7308 | 0.7249 | 0.6944 |
| NDCG@10 | 0.7934 | 0.7945 | 0.7582 |
| P@1 | 0.5776 | 0.5974 | 0.5121 |
| P@5 | 0.5316 | 0.5079 | 0.5116 |

| Classification | Validation | Test | Test, always No Fit |
|---|---|---|---|
| Thresholds (t1, t2) | 0.0362, 0.0455 (learned) | same, frozen | |
| Accuracy | 0.4607 | 0.4358 | 0.5441 |
| Macro precision | 0.4012 | 0.4039 | 0.1814 |
| Macro recall | 0.4053 | 0.4140 | 0.3333 |
| Macro F1 | 0.4020 | 0.3938 | 0.2349 |

Test confusion matrix (rows = true, columns = predicted; No / Potential / Good):
`[[318, 125, 205], [99, 62, 120], [67, 56, 139]]`.

**Interpretation.**
- TF-IDF ranks better than chance on every ranking metric except P@5. The margin is
  small, though: +0.036 NDCG@10 and +0.050 MRR on test. Mean scores rise with the label
  (test: No Fit 0.039 < Potential 0.044 < Good 0.049), so lexical overlap carries a real but weak
  signal.
- Ranking numbers look high in absolute terms mainly because jobs have few candidates
  (random MRR is already 0.71). They should always be read against the random reference.
- The thresholds were chosen to maximise **macro F1**, not accuracy. Macro F1 is far above
  always-No-Fit (0.394 vs 0.235), but accuracy is lower (0.436 vs 0.544). Potential Fit is the
  hardest class (62 of 281 correct): its score band is very narrow (0.036–0.046).
- Validation and test results are close, so there is no sign that the validation-chosen
  thresholds overfit.

## Transformer Semantic Baseline (`SEMANTIC_BASELINE`, Phase 4)

Code: `ml/models/semantic.py` · experiment: `python -m ml.evaluation.experiment semantic` ·
configuration: `experiments/config/semantic.json`

### TF-IDF vs transformer, in one line each

- **TF-IDF: lexical overlap.** Two texts are similar if they *use the same words*.
- **Transformer: semantic representation.** Two texts are similar if they *mean similar things*,
  even with different words ("built REST services in Flask" ≈ "backend API development").

### Why transformer embeddings?

TF-IDF's main weakness (above) is that it cannot link different words with the same meaning. A
transformer reads every word *in context* and was pretrained on very large text collections. It
learned that "ML engineer" and "machine learning developer" describe the same thing. Comparing
meaning instead of vocabulary should therefore rank candidates better.

### What is BGE?

**BGE** (BAAI General Embedding, by the Beijing Academy of Artificial Intelligence) is a family of
open sentence-embedding models. We use **`BAAI/bge-base-en-v1.5`**, pinned to Hugging Face revision
`a5beb1e3e68b9ab74eb54cfd186867f64f240e1a`:
- a BERT-base encoder (12 layers, about 110 M parameters), English;
- trained with contrastive learning so that related texts get nearby vectors;
- outputs a **768-dimensional** vector from the `[CLS]` token, followed by L2 normalisation (the
  model's own `Normalize` module);
- reads at most **512 tokens** per input.

The fallback `sentence-transformers/all-mpnet-base-v2` is used only if BGE cannot be loaded.
**It was not needed:** every reported result comes from BGE, and each metrics file records the
model actually loaded.

### How an embedding represents meaning

The text is split into sub-word tokens, and each token gets a vector. Twelve self-attention layers
then let every token's vector depend on all the others, so "Java" in "Java developer" differs
from "Java" in "Java coffee". The final `[CLS]` vector summarises the whole input: one point in a
768-dimensional space. Training placed texts with similar meaning close together in that space.

### Cosine similarity of embeddings

`score = cos(e_resume, e_job) = e_resume · e_job`. Embeddings have length 1, so cosine equals the
dot product. In principle it lies in [-1, 1]. In practice BGE scores are compressed into a narrow
high band: observed test range **0.448 – 0.799**. As the model card warns, an absolute value like
0.6 does **not** mean "60% similar". Only the *ordering* matters, and the classification
thresholds are learned on validation for that reason. The score is a similarity, not a probability.

### Decisions taken from the model card

| Question | Decision | Why |
|---|---|---|
| Query instruction ("Represent this sentence for searching relevant passages: ")? | **None** | The card recommends it only when a *short query* searches *long passages*. Resume vs job is long document vs long document, and v1.5 is designed to work without an instruction. |
| Separate query/document encoders? | **No**; `encode_resume` = `encode_job` | BGE v1.5 has one encoder; no asymmetric setup is needed. |
| Normalisation | **Yes** (built into the model) | Makes cosine = dot product. |
| Pooling | `[CLS]` (model default) | Unchanged from the published model. |

### Texts longer than 512 tokens

BGE reads at most 512 tokens (510 plus 2 special tokens). Our texts are much longer:

| Unique texts (val + test) | Median tokens | Over 510 tokens | Text lost by truncation |
|---|---|---|---|
| Resumes (validation) | 1,121 | 94% | 60% |
| Resumes (test) | 1,029 | 95% | 58% |
| Job descriptions (validation) | 430 | 41% | 26% |
| Job descriptions (test) | 416 | 39% | 25% |

Two strategies were implemented:
- **truncate**: embed only the first 510 tokens (the model's standard behaviour).
- **chunk_mean**: split into consecutive 510-token chunks (cut at token boundaries), embed each
  chunk, average the vectors weighted by chunk length, and re-normalise.

**Selection, using validation only.** The rule was fixed before any result was seen: keep the
strategy with the higher validation NDCG@10, and run only that one on test.

| Validation | NDCG@10 | NDCG@5 | MRR | MAP | P@1 | Macro F1 | From-scratch time (CPU) |
|---|---|---|---|---|---|---|---|
| chunk_mean | 0.8083 | 0.7495 | 0.7614 | 0.7285 | 0.5652 | 0.4262 | 787 s |
| **truncate (selected)** | **0.8114** | **0.7524** | **0.7729** | **0.7406** | **0.6025** | 0.4133 | 503 s |

Truncation won narrowly (+0.003 NDCG@10). We had expected the opposite. A plausible explanation
(not tested) is that the beginning of a resume holds the summary, key skills and most recent role,
while averaging in older history dilutes the vector. chunk_mean was never run on test; its validation
results are kept in `results/semantic_chunk_mean_validation_*`.

### Zero-shot, and leakage prevention

This is a **zero-shot** baseline: the pretrained model is used unchanged. It is not fine-tuned, and
no component is fitted on project data, so `fit()` does nothing. Train data is not used at all.
Labels are never used to produce a score (a unit test shuffles labels and checks scores are
unchanged). The same pretrained model embeds every split. The only learned quantities are the two
classification thresholds, learned on validation exactly as for TF-IDF.

### Text preprocessing

Only the conservative shared normalisation (`ml/models/text.py`, also used by TF-IDF):
noise characters removed, glued section headings split, whitespace collapsed. Case, punctuation and
technical terms are kept; the BGE tokenizer does its own lower-casing. No keyword stripping, no LLM.

### Computation, batching and caching

- **Device:** chosen automatically (`"device": "auto"` → CUDA if available, else CPU). All reported
  runs used **CPU** (PyTorch 2.14.1+cpu, 8 threads; no GPU available). No GPU is required.
- **Batch size:** 16 chunks per forward pass.
- **Cost:** about 0.9 s per 512-token chunk on this CPU. The full final experiment from scratch
  (525 distinct texts for validation + test, model load included) took **838 s**. Validation alone
  took 503 s (truncate) and 787 s (chunk_mean). With a warm cache, a rerun takes a few minutes.
- **Caching:** many pairs share a resume or job, so each *distinct* text is encoded once (keyed by
  SHA-1 of the normalised text). For example, validation has 2,518 resume/job lookups but only
  399 distinct texts.
- Embeddings are also saved to `artifacts/cache/semantic_<settings-hash>.npz` (git-ignored). The
  file name hashes the model name, revision and every encoding setting, so a different
  configuration can never reuse the wrong vectors. Caching is safe because embeddings are a
  deterministic function of the text alone; no labels are involved. Delete `artifacts/cache/`
  to regenerate everything. Re-running from the cache gave byte-identical predictions.
- Neither the model weights (downloaded to the Hugging Face cache) nor the embeddings are in Git.
  The experiment is reproducible from the model id, revision and configuration.

**Reproducibility: PASS.** The final configuration was run twice: once from the embedding cache
and once with caching disabled, so every embedding was recomputed. Scores were exactly equal
(max abs difference 0.0), and per-job orderings, predicted labels and all metrics were identical.
All runs were on CPU. GPU kernels can be slightly non-deterministic, so a CUDA run might differ in
the last floating-point digits.

### Semantic results (executed 2026-10-06)

Source: `results/semantic_{validation,test}_metrics.json`, `results/model_comparison.csv`.
Same split, same pairs, same eligible jobs and same metric code as TF-IDF. The comparison script
refuses to compare models evaluated on different pairs or job groups.

| | Validation | Test |
|---|---|---|
| Pairs scored | 1,259 | 1,191 |
| Jobs (total / eligible / binary-eligible) | 302 / 163 / 161 | 289 / 157 / 154 |
| Excluded: single candidate / single label | 73 / 66 | 85 / 47 |
| MRR | 0.7729 | 0.7870 |
| MAP | 0.7406 | 0.7531 |
| NDCG@5 | 0.7524 | 0.7653 |
| NDCG@10 | 0.8114 | 0.8231 |
| P@1 / P@5 | 0.6025 / 0.5465 | 0.6494 / 0.5339 |
| Accuracy | 0.4797 | 0.4769 |
| Macro precision / recall | 0.4143 / 0.4133 | 0.4274 / 0.4375 |
| Macro F1 | 0.4133 | 0.4226 |
| Thresholds (t1, t2) | 0.6291, 0.6612 (learned) | same, frozen |

Test confusion matrix (rows = true, columns = predicted; No / Potential / Good):
`[[369, 123, 156], [90, 64, 127], [73, 54, 135]]`.

### Random vs TF-IDF vs Semantic (test set)

| Model | MRR | MAP | NDCG@5 | NDCG@10 | P@1 | P@5 | Accuracy | Macro F1 |
|---|---|---|---|---|---|---|---|---|
| Random ordering | 0.7141 | 0.6670 | 0.6944 | 0.7582 | 0.5121 | 0.5116 | — | — |
| TF-IDF | 0.7638 | 0.7179 | 0.7249 | 0.7945 | 0.5974 | 0.5079 | 0.4358 | 0.3938 |
| Semantic (BGE) | **0.7870** | **0.7531** | **0.7653** | **0.8231** | **0.6494** | **0.5339** | **0.4769** | **0.4226** |
| Δ Semantic − TF-IDF | +0.0232 | +0.0352 | +0.0404 | +0.0286 | +0.0519 | +0.0260 | +0.0411 | +0.0288 |
| Relative change | +3.0% | +4.9% | +5.6% | +3.6% | +8.7% | +5.1% | +9.4% | +7.3% |

On validation the differences point the same way but are smaller (Δ NDCG@10 +0.018, Δ MRR +0.020,
Δ MAP +0.022, Δ NDCG@5 +0.022, Δ macro F1 +0.011).

The TF-IDF row is the historical Phase 3 result, read from its saved file and not recomputed.

### Interpretation

1. **Does semantic matching beat TF-IDF?** Yes, on every ranking and classification metric, on
   both validation and test.
2. **By how much?** Modestly: +0.029 NDCG@10, +0.040 NDCG@5, +0.035 MAP, +0.023 MRR,
   +0.052 P@1 on test. **No significance test has been run yet** (planned for the final
   comparison, using paired per-job scores). These are observed differences, not proven ones.
3. **Does it beat random?** Yes, on every ranking metric, including P@5, where TF-IDF did not.
   Its lift over random is about 1.8× TF-IDF's on NDCG@10 (+0.065 vs +0.036).
4. **Consistent across validation and test?** Same direction for every metric. Test gains are
   somewhat larger than validation gains. With roughly 160 ranked jobs per split this may be sampling
   variation, but that has not been tested.
5. **The two models disagree a lot:** Spearman correlation of their test scores is only 0.48.
   They capture partly different signals.
6. **What semantic matching still fails to model:**
   - **Fit vs topic.** Mean test scores are No Fit 0.620, Potential 0.651 and Good 0.660, so
     Potential and Good Fit are almost indistinguishable. The model measures *how related the
     topics are*, not *whether the candidate meets the requirements*. In 35% of the 154
     binary-eligible test jobs the top-ranked candidate is not relevant (P@1 = 0.649).
   - **No explicit requirements.** One vector per document cannot tell a mandatory skill from a
     nice-to-have, or notice that a single required skill is missing.
   - **No experience or seniority logic.** "3 years" and "10 years" embed almost the same.
   - **Truncation.** With the selected strategy, about 58–60% of each resume is never seen.
   - **Generic, not domain-tuned.** BGE was trained on general web and QA text, not on hiring
     decisions, and is zero-shot here.
   - **Length and boilerplate.** Company descriptions and benefits text in job ads add semantic
     content unrelated to fit.

These gaps (required vs preferred skills, experience and responsibility alignment) are exactly
what the Skill-Aware Hybrid (Phase 5) models explicitly.

## Skill extraction

TODO (Phase 5)

## Hybrid scoring (student innovation)

TODO (Phase 5)
