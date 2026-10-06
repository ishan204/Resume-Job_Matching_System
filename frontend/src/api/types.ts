// Types mirroring backend/app/schemas.py and the research endpoints. Scores are model scores, not probabilities.

export type ModelName = "tfidf" | "semantic" | "hybrid";
export const MODEL_NAMES: ModelName[] = ["tfidf", "semantic", "hybrid"];

export interface ResponsibilityEvidence {
  job_responsibility: string;
  candidate_experience: string;
  similarity: number;
}

export interface Experience {
  candidate_years: number | null;
  source: string | null;
  required_years: number | null;
  gap_years: number | null;
  requirement_evidence: string[];
}

export interface Explanation {
  summary: string;
  limitations?: string;
  top_shared_terms?: { term: string; contribution: number }[];
  weights?: Record<string, number>;
  components_used?: string[];
  strengths?: string[];
  gaps?: string[];
  uncertain_job_skills?: string[];
  skill_evidence?: Record<string, string>;
  requirement_evidence?: Record<string, string>;
  responsibility_evidence?: ResponsibilityEvidence[];
  education?: { candidate_level: number | null; required_level: number | null };
}

export interface MatchResult {
  model: ModelName;
  score: number;
  category: string;
  thresholds: number[];
  validation_percentile: number;
  components: Record<string, number | null>;
  matched_required_skills?: string[];
  missing_required_skills?: string[];
  matched_preferred_skills?: string[];
  missing_preferred_skills?: string[];
  experience?: Experience;
  responsibility_similarity?: number | null;
  explanation: Explanation;
  disclaimer: string;
}

export interface RankingRow {
  model: ModelName;
  score: number;
  category: string;
  validation_percentile: number;
}

export interface CompareResult {
  tfidf: MatchResult;
  semantic: MatchResult;
  hybrid: MatchResult;
  ranking: RankingRow[];
  note: string;
  disclaimer: string;
}

export interface Health {
  status: string;
  version: string;
  models: string[];
  models_loaded: boolean;
  disclaimer: string;
}

export interface Demo {
  resume: string;
  job_description: string;
  note: string;
}

export interface SkillWithEvidence {
  skill: string;
  evidence: string;
  category?: string;
}

export interface ParsedResume {
  text?: string;
  skills: SkillWithEvidence[];
  education: { level: string; evidence: string }[];
  highest_degree: string | null;
  experience: {
    total_years: number | null;
    source: string | null;
    date_ranges_found: number;
    stated_years: number | null;
    statements: string[];
  };
  projects: string[];
  certifications: string[];
  notes: string[];
}

export interface ParsedJob {
  title: string | null;
  required_skills: SkillWithEvidence[];
  preferred_skills: SkillWithEvidence[];
  uncertain_skills: SkillWithEvidence[];
  experience_requirement: { min_years: number | null; max_years: number | null; preferred_years: number | null; evidence: string[] };
  education: { required_level: string | null; preferred_level: string | null };
  responsibilities: string[];
  responsibilities_from_section: boolean;
  notes: string[];
}

export interface HeadlineRow {
  "test_ndcg@10": number | null;
  test_mrr: number | null;
  "repeated_mean_ndcg@10": number | null;
  repeated_mean_macro_f1: number | null;
}

export interface ResearchSummary {
  dataset: {
    name: string;
    raw_pairs: number;
    pairs: number;
    label_counts: Record<string, number>;
    removed: { exact_duplicates: number; conflicting_label_pairs: number; empty: number };
    unique_resumes: number;
    unique_jobs: number;
    splits: Record<string, number>;
    no_resume_overlap_between_splits: boolean;
    original_split_leakage: { original_test_resumes: number; also_in_original_train: number; share: number };
  };
  repeated_evaluation: { repetitions: number; all_leakage_free: boolean; test_jobs_eligible: number };
  models: number;
  student_innovation: string;
  headline: Record<string, HeadlineRow>;
  hybrid_vs_semantic_repeated: { "mean_ndcg@10_diff": number; ci95: [number, number]; splits_positive: number; splits: number };
  explainability_check: { pairs_checked: number; passed: Record<string, number>; all_checks_pass_for_all_pairs: boolean };
  limitations: string[];
}

/** One row of results/final_model_comparison.csv: keys like "test_ndcg@10", "repeated_mean_mrr". */
export type MetricRow = { model: string } & Record<string, number | string | null>;

export interface ResearchModels {
  rows: MetricRow[];
  primary_metrics: string[];
  secondary_metrics: string[];
}

export interface ResearchAblation {
  rows: ({ stage: string } & Record<string, number | string>)[];
  note: string;
}

export interface DifferenceRow {
  comparison: string;
  metric: string;
  mean_diff: number;
  std_diff: number;
  reps_positive: number;
  n_repetitions: number;
  ci95_low: number;
  ci95_high: number;
  ci_excludes_0: boolean;
}

export interface ResearchRobustness {
  summary: { model: string; metric: string; mean: number; std: number; min: number; max: number; n_repetitions: number }[];
  differences: DifferenceRow[];
  per_repetition: ({ repetition: number; model: string } & Record<string, number | string | null>)[];
  selection: ({ repetition: number; selected: string } & Record<string, number | string>)[];
}
