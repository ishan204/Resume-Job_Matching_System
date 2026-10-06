import { api } from "../api/client";
import { Card, ErrorBox, Loading, PageHeader, Stat, useAsync } from "../components/ui";

const LABELS: [string, string][] = [
  ["No Fit", "The candidate does not suit the job."],
  ["Potential Fit", "Partially suitable; relevant for ranking (graded relevance 1)."],
  ["Good Fit", "Suitable for the job (graded relevance 2)."],
];

const METRICS: [string, string][] = [
  ["MRR", "Mean Reciprocal Rank: 1 / position of the first relevant candidate, averaged over jobs. Rewards putting a good candidate at the top."],
  ["MAP", "Mean Average Precision: precision at every relevant candidate's position, averaged. Rewards ranking all relevant candidates high."],
  ["NDCG@5 / NDCG@10", "Normalised Discounted Cumulative Gain over the top 5 / 10: graded relevance (Good = 2, Potential = 1, No = 0), discounted by position and divided by the best possible ordering (0–1)."],
  ["P@1 / P@5", "Precision at 1 / 5: share of relevant candidates in the top 1 / 5."],
  ["Macro F1", "Secondary, classification view: each score is mapped to No / Potential / Good Fit with two thresholds learned on validation; F1 is averaged equally over the three classes."],
];

export function Methodology() {
  const { data, error, loading, retry } = useAsync(() => api.research.summary());
  return (
    <>
      <PageHeader title="Dataset & Methodology" lead="How the data was prepared, how leakage was prevented and how the models are evaluated." />
      {loading && <Loading text="Loading dataset facts…" />}
      {error && <ErrorBox message={error} onRetry={retry} />}
      {data && (
        <>
          <Card title="Dataset" subtitle={data.dataset.name}>
            <div className="stat-grid">
              <Stat label="Original pairs" value={data.dataset.raw_pairs.toLocaleString()} />
              <Stat label="Cleaned pairs" value={data.dataset.pairs.toLocaleString()} />
              <Stat label="Unique resumes" value={data.dataset.unique_resumes} />
              <Stat label="Unique jobs" value={data.dataset.unique_jobs} />
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th scope="col">Label</th><th scope="col">Meaning</th><th scope="col" className="num">Cleaned pairs</th></tr></thead>
                <tbody>
                  {LABELS.map(([l, m]) => (
                    <tr key={l}><th scope="row">{l}</th><td>{m}</td><td className="num">{data.dataset.label_counts[l]?.toLocaleString() ?? "—"}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted small">Cleaning removed {data.dataset.removed.exact_duplicates} exact duplicate and {data.dataset.removed.conflicting_label_pairs} conflicting-label rows.
              Every resume is paired with many jobs, which is why grouping matters.</p>
          </Card>

          <Card title="Leakage prevention">
            <p>The original supplied split was rejected:{" "}
              <strong>{data.dataset.original_split_leakage.also_in_original_train} of {data.dataset.original_split_leakage.original_test_resumes}</strong>{" "}
              original test resumes also appeared in train, so a model could be "tested" on resumes it had already seen.</p>
            <p>Instead, examples are grouped by resume (near-duplicate resumes are merged into one group), and whole groups are assigned to train, validation or test. {data.dataset.no_resume_overlap_between_splits
              ? "A leakage check verifies that no resume crosses the splits." : "Warning: the leakage check reports an overlap."}{" "}
              Anything learned is fitted on train (TF-IDF vocabulary) or validation (thresholds, hybrid weights); the test set is scored once at the end.
              The robustness study repeats this on {data.repeated_evaluation.repetitions} independent grouped splits.</p>
          </Card>

          <Card title="Models">
            <ol className="models-list">
              <li><strong>TF-IDF + cosine similarity</strong>: classical baseline; compares weighted word overlap.</li>
              <li><strong>BGE semantic similarity</strong>: pretrained transformer embeddings (BAAI/bge-base-en-v1.5), used zero-shot.</li>
              <li><strong>Skill-Aware Hybrid</strong>: the student-designed improvement; semantic similarity plus required/preferred skill coverage, experience compatibility and responsibility alignment, with weights chosen on validation data.</li>
            </ol>
          </Card>

          <Card title="Metrics" subtitle="Ranking metrics are primary: the system's job is to order candidates for a job. All are 0–1, higher is better.">
            <dl className="why">{METRICS.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
            <p className="muted small">For MRR, MAP and precision, “relevant” means Potential Fit or Good Fit. Scores are model scores, never probabilities.</p>
          </Card>
        </>
      )}
    </>
  );
}
