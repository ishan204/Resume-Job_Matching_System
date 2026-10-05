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

## Transformer embeddings and BGE

TODO (Phase 4)

## Semantic similarity

TODO (Phase 4)

## Skill extraction

TODO (Phase 5)

## Hybrid scoring (student innovation)

TODO (Phase 5)
