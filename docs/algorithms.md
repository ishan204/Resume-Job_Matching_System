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

## Student-Designed Skill-Aware Hybrid (`SKILL_AWARE_HYBRID`, Phase 5)

> **This is the project's own improvement**, a student-designed system improvement, not a claim of
> novel research. See also [innovation.md](innovation.md).

Code: `ml/models/hybrid.py`, `ml/features/*.py` · taxonomy: `config/skills.json` ·
candidate weights: `experiments/config/hybrid.json` · frozen weights: `config/matching_weights.json`
· selection: `python -m ml.evaluation.hybrid_select` · test run: `python -m ml.evaluation.experiment hybrid`

### 1–3. Why: the problem with both baselines

- **TF-IDF** compares *words*. It misses synonyms and has no idea what a requirement is.
- **BGE** compares *meaning*, but squeezes a whole document into one vector. A candidate who is
  "about" the right topic but lacks a mandatory skill still looks similar. Phase 4 showed this:
  BGE's mean test score is 0.651 for Potential Fit and 0.660 for Good Fit.
- Neither answers the questions a recruiter asks: *Does the candidate have the required skills?
  Which are missing? Enough years of experience? Have they done this kind of work?*

The hybrid adds explicit, explainable, requirement-aware features to the semantic score.

### 4. Skill extraction (`ml/features/skills.py`)

- **Taxonomy** `config/skills.json`: 178 canonical skills in 17 categories (programming, web, data,
  cloud, devops, AI, BI, office, accounting, finance, certifications, …), with 454 case-insensitive
  aliases plus a few case-sensitive ones. The choice of skills was guided by skill frequencies in
  **train** job descriptions only. The jobs are ~57% software/data/IT and ~27% finance/accounting.
- **Aliases are normalised**: ReactJS / React.js → React, NodeJS → Node.js, Postgres → PostgreSQL,
  ML → Machine Learning, K8s → Kubernetes.
- **Distinct technologies stay distinct**: one regex alternation is sorted longest-alias first, so at
  any position "JavaScript" wins over "Java" and "PostgreSQL" over "SQL". Python ≠ Java,
  AWS ≠ Azure, React ≠ Angular, Docker ≠ Kubernetes (all unit-tested).
- **Ambiguous words** only match in safe forms: "react quickly", "Spring 2019", "R&D",
  "go to market" and "excellent" are not skills. Plain "R" and "C" are not matched at all.
- **Glued text** (`ExcelPreparing`): a lowercase→Uppercase transition also counts as a word boundary.
- **Soft skills are excluded** on purpose ("communication" appears in 149 of 349 train jobs). They
  cannot be verified from a resume.
- Every extracted skill keeps its **evidence sentence**.

### 5. Required vs preferred (`ml/features/sections.py`)

The text has lost its line breaks, so headings are glued into running text
("…projects as assigned Required Qualifications1-3 years…"). Headings are therefore searched for
anywhere. They must be capitalised and followed by a capital, digit or colon, so "Experience in C#"
or "requirements are…" do not count. Each skill mention then gets a status:

1. **Cue in its own sentence**, choosing the cue *nearest* the skill: required ← required, must,
   mandatory, essential, minimum, need; preferred ← preferred, nice to have, bonus, desirable,
   a plus. "Python required, Terraform a plus" → Python required, Terraform preferred.
2. Otherwise **the section it is in** ("Required/Minimum/Basic Qualifications", "Requirements",
   generic "Qualifications" → required; "Preferred Qualifications", "Nice to have" → preferred).
3. Otherwise **uncertain**. It is kept as its own state, not forced into either class.

A skill mentioned several times keeps its strongest status. On the evaluation data, required skills
are detected for **71%** of pairs (median 2 per job) and preferred skills for **37–38%**.

### 6. Features (stored in every prediction file)

| Feature | Definition | Used in score |
|---|---|---|
| `semantic_similarity` | Phase 4 BGE cosine; min-max scaled with validation 1st/99th percentiles [0.473, 0.761], clipped to [0, 1] | yes |
| `required_skill_coverage` | matched required / required; **0 when none detected**, with `required_skill_count` = 0 to tell "none detected" from "none matched" | yes, if count > 0 |
| `preferred_skill_coverage` | same for preferred skills | yes, if count > 0 |
| `weighted_skill_coverage` | (req matches + α·pref matches) / (req + α·pref), **α = 0.5** (a preferred skill counts half; α < 1 keeps required more important) | diagnostic |
| `job_skill_coverage` | share of *all* detected job skills, including uncertain | diagnostic |
| `experience_match` | min(1, candidate years / required minimum years): 3 of 5 years → 0.6, graded not binary | yes, if both known |
| `responsibility_similarity` | see §7; scaled with validation percentiles [0.458, 0.710] | yes |
| `education_match` | 1 meets degree level, 0.5 one level below, 0 lower | diagnostic |
| counts, gap, years | `missing_required_skill_count`, `experience_gap`, `required_experience_years`, … | explanation |

**Experience** (`ml/features/experience.py`). For the job: "2+ years", "at least 3 years",
"5 years", "5–7 years", "minimum of two (2) years", "3 or more years". Only sentences that mention
experience are used; the strictest non-preferred minimum is taken. For the candidate: employment
date ranges (`04/2018toCurrent`, `09/2015-06/2016`, `January 2015 - Present`, `2012 - 2015`) outside
the Education section. **Overlapping jobs are merged** so they count once. "Present" is the latest
explicit date in the same resume: resumes are undated (written 2012–2023), so this deliberately
*undercounts* a current role rather than guessing. If no dates parse, the largest stated
"N years of experience" is used. Candidate years are known for 97–99% of pairs and the job states
years for 65–66%, so `experience_match` is available for 64%.

**Not implemented** (so not in the schema): relevant-experience years, seniority, job-title
similarity, project relevance, domain similarity. There is no title field and no reliable project
section in this data, so heuristics would have been noise. They are future work, not fabricated
features.

### 7. Responsibility alignment (`ml/features/responsibilities.py`)

Job duties = sentences under a responsibilities heading ("Responsibilities", "Essential Job
Functions", "What you'll do", …; found for 49–50% of jobs). Otherwise, all sentences outside the
benefits/company sections. Candidate evidence = sentences from the resume's experience section. Both
are embedded with the same BGE model, and each duty is matched to its **single best** candidate
sentence:

`responsibility_similarity = mean over duties of ( max over candidate sentences of cos(duty, sentence) )`

This is a different signal from whole-document similarity (sentence-level best match, experience
section only), so it does not simply double-count the semantic score. The best-matching pairs are
returned as evidence.

### 8. Hybrid formula

```
hybrid = Σ wᵢ · fᵢ  /  Σ wᵢ        summed over the components fᵢ AVAILABLE for this pair
```

- All fᵢ ∈ [0, 1] and wᵢ ≥ 0, so the hybrid is in [0, 1] (unit-tested).
- **Missing evidence is left out, not scored as 0.** If the job lists no required skills or states
  no years, those terms are dropped and the remaining weights renormalised. "Not stated" is not
  a mismatch.
- The score is a weighted similarity/coverage score, not a probability.

### 9. Weight selection (validation only)

Six weight sets were written into `experiments/config/hybrid.json` **before any result**. They are
small and principled: required always > preferred, each emphasising one aspect. They were compared on
validation with the rule *highest validation NDCG@10 wins, ties to the first listed*.
`hybrid_select.py` reads only `validation.csv`; a unit test points it at a folder containing only
`validation.csv`, so opening test would crash it. The scaling bounds are also fitted on validation.

| Validation | Sem | Req | Pref | Exp | Resp | NDCG@10 | MRR | MAP | Macro F1 |
|---|---|---|---|---|---|---|---|---|---|
| A_initial | .40 | .25 | .10 | .10 | .15 | 0.8010 | 0.7399 | 0.7286 | 0.4153 |
| **B_semantic_heavy (selected)** | **.60** | **.15** | **.05** | **.10** | **.10** | **0.8085** | 0.7705 | 0.7393 | 0.4240 |
| C_balanced | .25 | .25 | .10 | .15 | .25 | 0.7965 | 0.7379 | 0.7214 | 0.4077 |
| D_skill_heavy | .30 | .40 | .15 | .05 | .10 | 0.8034 | 0.7435 | 0.7309 | 0.4108 |
| E_experience_heavy | .30 | .20 | .10 | .30 | .10 | 0.8064 | 0.7596 | 0.7334 | 0.4127 |
| F_responsibility_heavy | .30 | .20 | .05 | .10 | .35 | 0.8039 | 0.7609 | 0.7294 | 0.4185 |

Frozen in `config/matching_weights.json`; the test set was then scored once. Classification
thresholds (learned on validation, frozen): t1 = 0.5190, t2 = 0.6639.

### 10. Ablation

Stages A–E use the initial weights restricted to the listed components (renormalised); F is the
frozen final model. The validation ablation was part of the protocol. The **test** ablation was run
only *after* freezing, as a report: every stage's thresholds come from validation, and nothing fed
back into any decision.

| Stage | Val NDCG@10 | Val MRR | Val F1 | Test NDCG@10 | Test MRR | Test MAP | Test F1 |
|---|---|---|---|---|---|---|---|
| A semantic only | **0.8114** | **0.7729** | 0.4133 | 0.8231 | 0.7870 | 0.7531 | 0.4226 |
| B + required skills | 0.8094 | 0.7539 | 0.4148 | 0.8177 | 0.7917 | 0.7474 | 0.4074 |
| C + preferred skills | 0.8041 | 0.7393 | 0.4172 | 0.8178 | 0.7874 | 0.7471 | 0.4348 |
| D + experience | 0.8060 | 0.7466 | 0.4184 | 0.8335 | 0.8103 | 0.7636 | 0.4280 |
| E + responsibilities | 0.8010 | 0.7399 | 0.4153 | 0.8411 | 0.8206 | 0.7781 | 0.4271 |
| F final (semantic-heavy) | 0.8085 | 0.7705 | **0.4240** | **0.8459** | **0.8341** | **0.7848** | **0.4386** |

Row A reproduces the Phase 4 semantic results exactly on both splits (consistency check).

### Results: Random vs TF-IDF vs BGE vs Hybrid (test, executed 2026-10-06)

Same 1,191 pairs, same 157 rankable jobs (154 for MRR/MAP/P@k), same metric code for every model.

| Model | MRR | MAP | NDCG@5 | NDCG@10 | P@1 | P@5 | Accuracy | Macro F1 |
|---|---|---|---|---|---|---|---|---|
| Random ordering | 0.7141 | 0.6670 | 0.6944 | 0.7582 | 0.5121 | 0.5116 | — | — |
| TF-IDF | 0.7638 | 0.7179 | 0.7249 | 0.7945 | 0.5974 | 0.5079 | 0.4358 | 0.3938 |
| Semantic BGE | 0.7870 | 0.7531 | 0.7653 | 0.8231 | 0.6494 | 0.5339 | 0.4769 | 0.4226 |
| **Skill-Aware Hybrid** | **0.8341** | **0.7848** | **0.7997** | **0.8459** | **0.7013** | **0.5508** | **0.5113** | **0.4386** |
| Hybrid − TF-IDF | +0.0703 | +0.0669 | +0.0748 | +0.0514 | +0.1039 | +0.0429 | +0.0755 | +0.0448 |
| Hybrid − BGE | +0.0471 | +0.0317 | +0.0345 | +0.0228 | +0.0519 | +0.0169 | +0.0344 | +0.0160 |
| Hybrid − Random | +0.1200 | +0.1178 | +0.1053 | +0.0877 | +0.1892 | +0.0391 | — | — |

Hybrid test confusion matrix (rows = true, columns = predicted; No / Potential / Good):
`[[433, 148, 67], [108, 99, 74], [94, 91, 77]]`.

**Paired bootstrap over jobs** (`results/significance_test.csv`; 10,000 resamples, seed 42; jobs are
resampled, not candidate rows):

| Difference | NDCG@10 [95% CI] | MRR [95% CI] | MAP [95% CI] | NDCG@5 [95% CI] |
|---|---|---|---|---|
| BGE − TF-IDF (test) | +0.029 [+0.001, +0.056] | +0.023 [−0.025, +0.072] | +0.035 [+0.000, +0.069] | +0.040 [+0.010, +0.072] |
| Hybrid − TF-IDF (test) | +0.051 [+0.026, +0.078] | +0.070 [+0.025, +0.116] | +0.067 [+0.034, +0.099] | +0.075 [+0.045, +0.106] |
| Hybrid − BGE (test) | +0.023 [+0.007, +0.039] | +0.047 [+0.015, +0.080] | +0.032 [+0.012, +0.052] | +0.034 [+0.017, +0.053] |
| *Hybrid − BGE (validation)* | −0.003 [−0.018, +0.012] | −0.002 [−0.034, +0.029] | −0.001 [−0.022, +0.018] | −0.003 [−0.023, +0.015] |

No multiple-comparison correction is applied. The hybrid − BGE test p-values (0.0002–0.0038) would
still pass a Bonferroni threshold of 0.05/12 ≈ 0.004. BGE − TF-IDF would not.

### Interpretation (answering the research question honestly)

1. **Does the hybrid outperform BGE?** On the test split: yes, on every metric, and the ranking
   gains are statistically significant. On the validation split: no, it is equal to BGE within
   noise. **The improvement does not replicate across the two held-out splits.**
2. **Does it outperform TF-IDF?** Yes, clearly, on both splits and every metric (test CIs exclude 0).
3. **Which additions help?** No single addition helps consistently. On test, experience (+0.016
   NDCG@10) and responsibilities (+0.008) add the most. On validation they add +0.002 and −0.005.
   Giving more weight to semantic similarity (B vs A) helped on both splits.
4. **Does required-skill coverage help?** **Not for ranking, on either split** (NDCG@10 −0.002 val,
   −0.005 test when added). Its within-job correlation with the label is weak and unstable
   (+0.06 val, +0.20 test). It is still the most useful part of the *explanation*.
5. **Does experience help?** Mixed: +0.002 (val) and +0.016 (test) NDCG@10. Its within-job
   correlation with the label is +0.21 on validation but −0.01 on test.
6. **Does responsibility similarity help?** Mixed: −0.005 (val), +0.008 (test).
7. **Does it improve one metric while harming another?** On validation, the final hybrid trades a
   little ranking (−0.003 NDCG@10, −0.002 MRR) for better classification (macro F1 +0.011,
   accuracy +0.018). On test it improves everything.
8. **Consistent between validation and test?** Not for ranking. Extraction coverage is identical in
   both splits (required skills for 71% of pairs, experience for 64%), so the parsing behaves the
   same. What changes is how strongly each feature tracks the label inside a job, across two
   samples of only ~96 resumes. A single 15% split cannot settle a difference of this size;
   repeated grouped splits (cross-validation) are needed and planned for the final experiments.
9. **Verdict.** H1 is supported on the held-out test split, but the evidence overall is promising,
   not conclusive. Individually, the explicit features carry signal: on validation, ranking by
   preferred-skill coverage alone gives NDCG@10 0.8231, by experience match alone 0.8204, and by
   semantic alone 0.8114. A hand-weighted linear sum does not reliably turn that into better
   rankings. Learning the weights, for example on the currently unused train split, is the natural
   next step.

### 11. Explainability

`HybridMatcher.explain(resume, job)` returns the overall score, each component (and which were
used), matched and missing required/preferred skills with their evidence sentences, uncertain job
skills, candidate vs required years and the gap, degree levels, the best-matching duty ↔
experience sentence pairs, and template strengths/gaps generated only from these values (no LLM).
Unit tests check that the explanation agrees with the feature row and that all evidence comes from
the parsed text.

**Real test example** (job `77f71b61c082`, 15 candidates; resume texts not reproduced):

| | Candidate `0dee9d37d6b6` (true: No Fit) | Candidate `bdc270cf986a` (true: Good Fit) |
|---|---|---|
| Rank by BGE → by hybrid | **#1 → #4** | **#3 → #1** |
| Semantic (scaled) | 0.896 | 0.803 |
| Required skills | **0 of 1: missing Agile** | 1 of 1: Agile |
| Preferred skills | 0 of 3 (missing Jira, Oracle Database, SQL) | 2 of 3 (Oracle Database, SQL) |
| Experience | job states no years → not scored | job states no years → not scored |
| Hybrid score | 0.654 | 0.796 |
| Generated gaps | "0 of 1 required skills found; missing: Agile" | none |

The requirement evidence for Agile is the job's own sentence "Must have experience working in an
Agile environment." Another test pair (`1d07257e881a`, true No Fit) gets the gaps "missing: Angular"
and "Estimated experience 0.5 years is below the 7 years requested".

### 12. Limitations

- **Unstable gains:** see point 8. The main result needs cross-validation.
- **Extraction errors remain.** Seen while preparing the example above, i.e. after the test run, so
  deliberately **not** fixed to avoid tuning on test: in "RequiredSQL Experience8" the glued
  "Required" is not recognised, so SQL was labelled *preferred*. All-caps words glued together
  ("SQLExcel") are missed. Generic "Qualifications" sections are treated as required.
- **Taxonomy coverage:** 178 skills, mostly tech and finance. Skills outside it are invisible, and
  soft skills are excluded by design.
- **Experience is approximate:** "Present" undercounts current roles, year-only ranges are coarse,
  and relevant (domain-specific) experience is not separated from total experience.
- **Hand-set weights:** six pre-declared linear weightings; the features may interact non-linearly.
- **Education** is level-only and diagnostic; field of study is not matched.
- **Fairness:** no protected or personal attributes are extracted or used (no name, age, gender,
  nationality, address, photo, marital status). The features are skills, years, degree level and
  duty text. Degree requirements can still carry indirect bias, which is one reason education is
  kept out of the score.
