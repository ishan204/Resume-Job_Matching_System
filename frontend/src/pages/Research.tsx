import { useState } from "react";
import { api } from "../api/client";
import type { MetricRow, ResearchAblation, ResearchRobustness, ResearchSummary } from "../api/types";
import { IntervalRow, MetricBars } from "../components/charts";
import { Card, ErrorBox, Loading, PageHeader, Stat, useAsync } from "../components/ui";
import { fmt, METRIC_LABEL, MODEL_COLOR, MODEL_LABEL, RESEARCH_ROW_LABEL, signed } from "../labels";
import { findRow, num, REPEATED_MODELS } from "./Dashboard";

const RANKING = ["mrr", "map", "ndcg@5", "ndcg@10", "p@1", "p@5"];
const CLASSIFICATION = ["accuracy", "macro_f1"];
const STAGE_LABEL: Record<string, string> = {
  A_semantic_only: "Semantic only",
  "B_+required_skills": "+ Required skills",
  "C_+preferred_skills": "+ Preferred skills",
  "D_+experience": "+ Experience",
  "E_+responsibilities": "+ Responsibilities",
  F_final: "Final hybrid",
};

export function Research() {
  const { data, error, loading, retry } = useAsync(() =>
    Promise.all([api.research.summary(), api.research.models(), api.research.ablation(), api.research.robustness()]));
  return (
    <>
      <PageHeader title="Research results"
                  lead="Every number on this page is read from the committed experiment results through the API; nothing is recomputed in the browser." />
      {loading && <Loading text="Loading research results…" />}
      {error && <ErrorBox message={error} onRetry={retry} />}
      {data && (
        <>
          <Setup s={data[0]} />
          <ModelTable rows={data[1].rows} />
          <Repeated rows={data[1].rows} rob={data[3]} />
          <Ablation ab={data[2]} />
          <Statistics rob={data[3]} />
          <Limitations items={data[0].limitations} />
        </>
      )}
    </>
  );
}

function Setup({ s }: { s: ResearchSummary }) {
  const d = s.dataset;
  const leak = d.original_split_leakage;
  return (
    <Card title="A. Experimental setup">
      <div className="stat-grid">
        <Stat label="Original pairs" value={d.raw_pairs.toLocaleString()} />
        <Stat label="Cleaned pairs" value={d.pairs.toLocaleString()}
              note={`${d.removed.exact_duplicates} duplicate, ${d.removed.conflicting_label_pairs} conflicting-label rows removed`} />
        <Stat label="Unique resumes" value={d.unique_resumes} />
        <Stat label="Unique jobs" value={d.unique_jobs} />
      </div>
      <div className="grid-2">
        <div className="callout callout-bad">
          <strong>Original dataset split: rejected (leaky)</strong>
          <p>{leak.also_in_original_train} of {leak.original_test_resumes} resumes in the supplied test split also appear in its train split.</p>
        </div>
        <div className="callout callout-good">
          <strong>Current methodology: resume-grouped splits</strong>
          <p>Train / validation / test = {d.splits.train.toLocaleString()} / {d.splits.validation.toLocaleString()} / {d.splits.test.toLocaleString()} pairs.{" "}
            {d.no_resume_overlap_between_splits ? "Verified: no resume overlap between splits." : "Resume overlap detected."}</p>
        </div>
      </div>
    </Card>
  );
}

function ModelTable({ rows }: { rows: MetricRow[] }) {
  const [split, setSplit] = useState<"test" | "validation">("test");
  const order = ["random", "tfidf", "semantic", "hybrid", "hybrid_parserfix"];
  return (
    <Card title="B. Model comparison on the original held-out split"
          actions={
            <div className="segmented" role="group" aria-label="Split">
              {(["test", "validation"] as const).map((s) => (
                <button key={s} aria-pressed={split === s} onClick={() => setSplit(s)}>{s === "test" ? "Test" : "Validation"}</button>
              ))}
            </div>
          }>
      <div className="table-wrap">
        <table className="table metrics-table">
          <thead>
            <tr><th scope="col" rowSpan={2}>Model</th><th scope="colgroup" colSpan={RANKING.length}>Ranking (primary)</th>
              <th scope="colgroup" colSpan={CLASSIFICATION.length} className="group-secondary">Classification (secondary)</th></tr>
            <tr>{[...RANKING, ...CLASSIFICATION].map((m) => (
              <th key={m} scope="col" className={`num ${CLASSIFICATION.includes(m) ? "group-secondary" : ""}`}>{METRIC_LABEL[m]}</th>))}</tr>
          </thead>
          <tbody>
            {order.map((m) => {
              const r = findRow(rows, m);
              if (!r) return null;
              const best = (k: string) => Math.max(...order.filter((x) => x !== "random").map((x) => num(findRow(rows, x), `${split}_${k}`) ?? -1));
              return (
                <tr key={m}>
                  <th scope="row">{RESEARCH_ROW_LABEL[m]}</th>
                  {[...RANKING, ...CLASSIFICATION].map((k) => {
                    const v = num(r, `${split}_${k}`);
                    const top = m !== "random" && v !== null && v === best(k);
                    return <td key={k} className={`num ${top ? "best" : ""} ${CLASSIFICATION.includes(k) ? "group-secondary" : ""}`}>
                      {fmt(v)}{top && <span className="visually-hidden"> (best)</span>}</td>;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted small">Bold = best non-random value per column. Random ordering has no classification metrics.
        The Phase 5 hybrid used the original parser; the served hybrid includes a later parser fix (glued requirement words) and is the one evaluated on repeated splits.</p>
    </Card>
  );
}

/** Says, from the data, whether the best model for ranking and for classification differ. */
function objectiveNote(models: MetricRow[]) {
  const best = (k: string) => models.reduce((a, b) => ((num(b, k) ?? -1) > (num(a, k) ?? -1) ? b : a));
  const rank = best("repeated_mean_ndcg@10"), cls = best("repeated_mean_macro_f1");
  return rank.model === cls.model
    ? `${MODEL_LABEL[rank.model]} is best on both the ranking and the classification objective.`
    : `The two objectives disagree: ${MODEL_LABEL[rank.model]} has the best mean ranking quality (NDCG@10), while ${MODEL_LABEL[cls.model]} has the best mean macro F1.`;
}

function Repeated({ rows, rob }: { rows: MetricRow[]; rob: ResearchRobustness }) {
  const models = REPEATED_MODELS.map((m) => findRow(rows, m)).filter(Boolean) as MetricRow[];
  const random = findRow(rows, "random");
  const bars = (metric: string) => models.map((r) => ({
    name: MODEL_LABEL[r.model], color: MODEL_COLOR[r.model],
    value: num(r, `repeated_mean_${metric}`) ?? 0, sd: num(r, `repeated_std_${metric}`) ?? undefined,
  }));
  const reps = [...new Set(rob.per_repetition.map((p) => p.repetition))].sort();
  const cell = (rep: number, model: string) => rob.per_repetition.find((p) => p.repetition === rep && p.model === model);
  return (
    <Card title="C. Repeated grouped evaluation" subtitle={`${reps.length} independent resume-grouped splits; everything learned (TF-IDF vocabulary, hybrid weights, thresholds) is re-learned in each. Mean ± SD.`}>
      <div className="grid-2">
        <div>
          <h4>Ranking objective: NDCG@10 <span className="muted">(higher is better)</span></h4>
          <MetricBars metric="NDCG@10" domain={[0.7, 0.9]} data={bars("ndcg@10")}
                      reference={random ? { value: num(random, "repeated_mean_ndcg@10") ?? 0, label: "Random" } : undefined} />
        </div>
        <div>
          <h4>Classification objective: Macro F1 <span className="muted">(higher is better)</span></h4>
          <MetricBars metric="Macro F1" domain={[0.3, 0.5]} data={bars("macro_f1")} />
        </div>
      </div>
      <p className="note">{objectiveNote(models)}</p>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th scope="col">Model</th>{["ndcg@10", "mrr", "map", "macro_f1"].map((m) => <th key={m} scope="col" className="num">{METRIC_LABEL[m]} (mean ± SD)</th>)}</tr></thead>
          <tbody>
            {[random, ...models].filter(Boolean).map((r) => (
              <tr key={r!.model}>
                <th scope="row">{RESEARCH_ROW_LABEL[r!.model]}</th>
                {["ndcg@10", "mrr", "map", "macro_f1"].map((m) => {
                  const mean = num(r, `repeated_mean_${m}`);
                  const sd = num(r, `repeated_std_${m}`);
                  return <td key={m} className="num">{mean === null ? "—" : `${fmt(mean)} ± ${fmt(sd)}`}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="details">
        <summary>NDCG@10 in each split, and the hybrid weighting selected on that split's validation data</summary>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th scope="col">Split</th>{["random", "tfidf", "semantic", "hybrid"].map((m) => <th key={m} scope="col" className="num">{MODEL_LABEL[m]}</th>)}<th scope="col">Hybrid weighting</th></tr></thead>
            <tbody>
              {reps.map((rep) => (
                <tr key={rep}>
                  <th scope="row">{rep + 1}</th>
                  {["random", "tfidf", "semantic", "hybrid"].map((m) => <td key={m} className="num">{fmt(Number(cell(rep, m)?.["ndcg@10"]))}</td>)}
                  <td>{String(rob.selection.find((s) => s.repetition === rep)?.selected ?? "—").replace(/^[A-F]_/, "").replace(/_/g, " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </Card>
  );
}

function Ablation({ ab }: { ab: ResearchAblation }) {
  const rows: (Record<string, number | string> & { label: string })[] =
    ab.rows.map((r) => ({ ...r, label: STAGE_LABEL[String(r.stage)] ?? String(r.stage) }));
  const base = (col: string) => Number(rows[0][col]);
  const views = [
    { col: "repeated_mean_ndcg@10", sd: "repeated_std_ndcg@10", title: "Repeated splits (mean ± SD)" },
    { col: "phase5_test_ndcg@10", title: "Original test split" },
    { col: "phase5_validation_ndcg@10", title: "Original validation split" },
  ];
  return (
    <Card title="D. Ablation: what each component adds to ranking (NDCG@10)"
          subtitle="Components added one at a time to semantic similarity. Dashed line = semantic only.">
      <MetricBars metric="NDCG@10" domain={[0.76, 0.88]} height={280}
                  reference={{ value: base(views[0].col), label: "Semantic only" }}
                  data={rows.map((r, i) => ({ name: r.label, value: Number(r[views[0].col]), sd: Number(r[views[0].sd!]),
                                              color: i === 0 ? "#eb6834" : "#1baf7a" }))} />
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th scope="col">Stage</th>{views.map((v) => <th key={v.col} scope="col" className="num">{v.title}</th>)}<th scope="col">Versus semantic only</th></tr></thead>
          <tbody>
            {rows.map((r, i) => {
              const deltas = views.map((v) => Number(r[v.col]) - base(v.col));
              const verdict = i === 0 ? "baseline" : deltas.every((d) => d < 0) ? "lower in every view" :
                deltas.every((d) => d > 0) ? "higher in every view" : "mixed across views";
              return (
                <tr key={String(r.stage)} className={i > 0 && deltas.every((d) => d < 0) ? "row-warn" : ""}>
                  <th scope="row">{r.label}</th>
                  {views.map((v, j) => <td key={v.col} className="num">{fmt(Number(r[v.col]))}{i > 0 && <span className="delta"> ({signed(deltas[j])})</span>}</td>)}
                  <td>{i > 0 && deltas.every((d) => d < 0) && <span aria-hidden="true" className="icon-bad">! </span>}{verdict}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="note">{rows.slice(1, -1).map((r) => {
        const d = views.map((v) => Number(r[v.col]) - base(v.col));
        const verdict = d.every((x) => x < 0) ? "lower than semantic only in every view"
          : d.every((x) => x > 0) ? "higher than semantic only in every view" : "mixed across views";
        return `${r.label}: ${verdict}.`;
      }).join(" ")} {ab.note}</p>
    </Card>
  );
}

function Statistics({ rob }: { rob: ResearchRobustness }) {
  const rows = rob.differences.filter((d) => ["ndcg@10", "mrr"].includes(d.metric));
  const lo = Math.min(0, ...rows.map((d) => d.ci95_low));
  const hi = Math.max(...rows.map((d) => d.ci95_high));
  const pad = (hi - lo) * 0.08;
  return (
    <Card title="E. Statistical evidence"
          subtitle="Estimates from the repeated grouped evaluation: mean difference over 5 splits, with a 95% interval from resampling jobs within each split.">
      <div className="interval-list">
        {rows.map((d) => (
          <div key={`${d.comparison}-${d.metric}`}>
            <IntervalRow label={`${d.comparison.replace("hybrid", "Hybrid").replace("semantic", "BGE").replace("tfidf", "TF-IDF").replace(" - ", " − ")} · ${METRIC_LABEL[d.metric]}`}
                         mean={d.mean_diff} low={d.ci95_low} high={d.ci95_high} scale={[lo - pad, hi + pad]} />
            <span className="interval-note">{d.reps_positive} of {d.n_repetitions} splits favour the first model · {d.ci_excludes_0 ? "interval excludes 0" : "interval includes 0"}</span>
          </div>
        ))}
      </div>
      <p className="muted small">The vertical line marks zero difference. No multiple-comparison correction is applied.</p>
    </Card>
  );
}

function Limitations({ items }: { items: string[] }) {
  return (
    <Card title="F. Limitations">
      <ul className="limitations">{items.map((l) => <li key={l}>{l}</li>)}</ul>
    </Card>
  );
}
