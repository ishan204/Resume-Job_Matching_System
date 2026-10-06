// Display names, colours and number formatting. No metric values live here.
import type { ModelName } from "./api/types";

export const MODEL_LABEL: Record<string, string> = {
  random: "Random ordering",
  tfidf: "TF-IDF",
  semantic: "BGE Semantic",
  hybrid: "Skill-Aware Hybrid",
  hybrid_parserfix: "Skill-Aware Hybrid",
};

/** Research tables contain two hybrid rows; these labels keep them apart. */
export const RESEARCH_ROW_LABEL: Record<string, string> = {
  random: "Random ordering",
  tfidf: "TF-IDF",
  semantic: "BGE Semantic",
  hybrid: "Hybrid (Phase 5, original parser)",
  hybrid_parserfix: "Skill-Aware Hybrid (served, parser fix)",
};

export const MODEL_KIND: Record<ModelName, string> = {
  tfidf: "Lexical similarity",
  semantic: "Semantic similarity",
  hybrid: "Semantic + explicit requirement-aware features",
};

// Validated categorical palette (blue / orange / aqua); aqua is below 3:1 so values are always labelled.
export const MODEL_COLOR: Record<string, string> = {
  tfidf: "#2a78d6",
  semantic: "#eb6834",
  hybrid: "#1baf7a",
  hybrid_parserfix: "#1baf7a",
  random: "#898781",
};

export const METRIC_LABEL: Record<string, string> = {
  mrr: "MRR",
  map: "MAP",
  "ndcg@5": "NDCG@5",
  "ndcg@10": "NDCG@10",
  "p@1": "P@1",
  "p@5": "P@5",
  accuracy: "Accuracy",
  macro_precision: "Macro precision",
  macro_recall: "Macro recall",
  macro_f1: "Macro F1",
};

export const COMPONENT_LABEL: Record<string, string> = {
  semantic_score: "Semantic similarity",
  required_skill_coverage: "Required skill coverage",
  preferred_skill_coverage: "Preferred skill coverage",
  experience_match: "Experience match",
  responsibility_similarity: "Responsibility similarity",
  semantic_similarity: "Semantic similarity",
};

export const fmt = (v: number | null | undefined, digits = 3) =>
  v === null || v === undefined || Number.isNaN(v) ? "—" : v.toFixed(digits);

export const signed = (v: number, digits = 3) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(digits)}`;

export const pct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${Math.round(v * 100)}%`);
