import { api } from "../api/client";
import type { MetricRow } from "../api/types";
import { MetricBars } from "../components/charts";
import { Card, ErrorBox, Loading, PageHeader, Stat, useAsync } from "../components/ui";
import { fmt, MODEL_COLOR, MODEL_LABEL, signed } from "../labels";

export const num = (row: MetricRow | undefined, key: string) => {
  const v = row?.[key];
  return typeof v === "number" ? v : null;
};
export const findRow = (rows: MetricRow[], model: string) => rows.find((r) => r.model === model);

/** Rows used for "the three approaches": the served hybrid is the one evaluated on repeated splits. */
export const REPEATED_MODELS = ["tfidf", "semantic", "hybrid_parserfix"];

export function Dashboard() {
  const { data, error, loading, retry } = useAsync(() => Promise.all([api.research.summary(), api.research.models()]));
  return (
    <>
      <PageHeader title="Explainable AI-Based Resume–Job Matching"
                  lead="Semantic and skill-aware ranking for resume–job matching" />
      <div className="cta-row">
        <a className="btn btn-primary" href="#/match">Analyze a Resume</a>
        <a className="btn" href="#/research">View research results</a>
      </div>
      {loading && <Loading text="Loading research results…" />}
      {error && <ErrorBox message={error} onRetry={retry} />}
      {data && <DashboardBody summary={data[0]} rows={data[1].rows} />}
    </>
  );
}

function DashboardBody({ summary, rows }: { summary: Awaited<ReturnType<typeof api.research.summary>>; rows: MetricRow[] }) {
  const ds = summary.dataset;
  const rep = summary.repeated_evaluation;
  const models = REPEATED_MODELS.map((m) => findRow(rows, m)).filter(Boolean) as MetricRow[];
  const best = (key: string) => models.reduce((a, b) => ((num(b, key) ?? -1) > (num(a, key) ?? -1) ? b : a));
  const bestRank = best("repeated_mean_ndcg@10");
  const bestF1 = best("repeated_mean_macro_f1");
  const hb = summary.hybrid_vs_semantic_repeated;
  const random = findRow(rows, "random");
  return (
    <>
      <div className="stat-grid">
        <Stat label="Primary approaches" value={summary.models} note="TF-IDF · BGE · Hybrid" />
        <Stat label="Unique resumes" value={ds.unique_resumes.toLocaleString()} />
        <Stat label="Unique jobs" value={ds.unique_jobs.toLocaleString()} />
        <Stat label="Repeated grouped evaluations" value={rep.repetitions} note={`${rep.test_jobs_eligible} test jobs in total`} />
      </div>

      <div className="grid-2-1">
        <Card title="Ranking quality: NDCG@10 by model"
              subtitle={`Mean ± SD over ${rep.repetitions} resume-grouped test splits (higher is better, 0–1 scale)`}>
          <MetricBars metric="NDCG@10" domain={[0.7, 0.9]}
                      reference={random ? { value: num(random, "repeated_mean_ndcg@10") ?? 0, label: "Random ordering" } : undefined}
                      data={models.map((r) => ({
                        name: MODEL_LABEL[r.model], color: MODEL_COLOR[r.model],
                        value: num(r, "repeated_mean_ndcg@10") ?? 0, sd: num(r, "repeated_std_ndcg@10") ?? undefined,
                      }))} />
        </Card>
        <Card title="Research finding">
          <p>
            The <strong>{MODEL_LABEL[bestRank.model]}</strong> achieved the strongest ranking performance across the
            repeated grouped evaluation (mean NDCG@10 {fmt(num(bestRank, "repeated_mean_ndcg@10"))}), while{" "}
            <strong>{MODEL_LABEL[bestF1.model]}</strong> retained the strongest average classification macro F1
            ({fmt(num(bestF1, "repeated_mean_macro_f1"))}).
          </p>
          <p className="muted">
            The hybrid's lead over BGE is small but consistent: {signed(hb["mean_ndcg@10_diff"])} NDCG@10
            (95% interval {signed(hb.ci95[0])} to {signed(hb.ci95[1])}), positive in {hb.splits_positive} of {hb.splits} splits.
          </p>
          <a href="#/research" className="link">Full results and limitations →</a>
        </Card>
      </div>

      <Card title="How the evaluation was done">
        <ul className="method-list">
          <li><strong>Leakage-safe grouped splitting.</strong> No resume appears in more than one of train, validation and test.</li>
          <li><strong>Ranking-first evaluation.</strong> Candidates are ranked per job; NDCG, MRR and MAP are the primary metrics.</li>
          <li><strong>Repeated grouped evaluation.</strong> The whole method is re-run on {rep.repetitions} independent resume-grouped splits.</li>
          <li><strong>Explainable feature-based hybrid.</strong> Scores come with matched and missing skills, experience and evidence.</li>
        </ul>
      </Card>
    </>
  );
}
