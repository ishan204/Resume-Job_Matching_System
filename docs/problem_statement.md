# Problem Statement

## Manual screening is time-consuming

Recruiters receive many applications per vacancy and read each resume against the job
description by hand. This is slow and inconsistent between reviewers.

## Keyword matching misses semantic relationships

Traditional applicant-tracking systems count shared words (TF-IDF / keyword overlap).
"Built REST services in Flask" and "backend API development" share almost no words, so a
lexical system under-scores a relevant candidate.

## Semantic matching ignores mandatory requirements

Transformer embeddings capture meaning, but compress a whole document into one vector.
A resume can be *about the same thing* as a job while missing a requirement the job
calls mandatory (e.g. the job requires Python, PyTorch **and AWS**; the candidate has only
Python and PyTorch). Pure semantic similarity has no explicit notion of "required".

## Proposed hybrid system

A **Skill-Aware Hybrid** (the student-designed improvement) combines semantic similarity with
explicit, explainable features: required skill coverage, preferred skill coverage, experience
compatibility and responsibility alignment. Every score component is traceable to text evidence.

## Task formulation: classification and ranking

Given resume **R** and job description **J**, predict `relevance(R, J)` ∈ {No Fit, Potential Fit, Good Fit}.

1. **Classification** — assign one of the three labels to a (R, J) pair.
2. **Ranking** (primary) — for a job J, order its candidate resumes so the best fits come first.

Research question: does the hybrid improve on TF-IDF and pure semantic matching?
H0: no significant improvement over semantic matching. H1: significant improvement.
The experiment decides; the hybrid is not assumed to win.
