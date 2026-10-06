import { useEffect, useState } from "react";
import { api } from "../api/client";
import { MODEL_NAMES, type CompareResult, type MatchResult } from "../api/types";
import { MetricBars } from "../components/charts";
import { JobInput, ResumeInput, useLoadDemo } from "../components/Inputs";
import { ScoreHeader } from "../components/MatchResult";
import { Card, CategoryBadge, Disclaimer, ErrorBox, Loading, PageHeader, SkillList, errorMessage } from "../components/ui";
import { fmt, MODEL_COLOR, MODEL_KIND, MODEL_LABEL } from "../labels";
import { navigate } from "../router";
import { useAppState } from "../state";
import { inputProblem } from "./MatchAnalysis";

export function Comparison() {
  const { resume, job, compare, setCompare, setMatch, setModel, key } = useAppState();
  const demo = useLoadDemo();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fresh = compare?.key === key ? compare.value : null;

  const run = async () => {
    const problem = inputProblem(resume, job);
    if (problem) return setError(problem);
    setError(null);
    setRunning(true);
    try {
      setCompare({ key, value: await api.compare(resume, job) });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setRunning(false);
    }
  };

  // Run automatically when arriving with inputs that have not been compared yet (never re-run for unchanged inputs).
  useEffect(() => {
    if (!fresh && !inputProblem(resume, job)) run();
  }, []);

  const openHybrid = (r: CompareResult) => {
    setMatch({ key, value: r.hybrid });
    setModel("hybrid");
    navigate("match");
  };

  const hasInputs = !inputProblem(resume, job);
  return (
    <>
      <PageHeader title="Model Comparison"
                  lead="The same resume and job description, scored by all three approaches." />
      <details className="details inputs-details" open={!hasInputs}>
        <summary>Inputs {hasInputs ? "(loaded — expand to edit)" : ""}</summary>
        <div className="toolbar">
          <button className="btn" onClick={demo.load} disabled={demo.loading}>{demo.loading ? "Loading demo…" : "Load Demo"}</button>
        </div>
        {demo.error && <ErrorBox message={demo.error} />}
        <div className="grid-2 inputs"><ResumeInput /><JobInput /></div>
      </details>
      <div className="action-bar">
        <span className="muted small">{fresh ? "Showing results for the current inputs." : compare ? "Inputs changed since the last comparison." : ""}</span>
        <button className="btn btn-primary" onClick={run} disabled={running || !!fresh}>
          {fresh ? "Up to date" : "Compare Models"}
        </button>
      </div>
      {error && <ErrorBox message={error} />}
      {running && (
        <>
          <Loading text="Comparing models…" />
          <div className="grid-3">
            {MODEL_NAMES.map((m) => (
              <Card key={m} className="pending"><span className="eyebrow">{MODEL_LABEL[m]}</span><p className="muted">Running {MODEL_LABEL[m]}…</p></Card>
            ))}
          </div>
        </>
      )}
      {fresh && !running && <ComparisonBody r={fresh} onOpenHybrid={() => openHybrid(fresh)} />}
      <WhyDifferent />
    </>
  );
}

function ComparisonBody({ r, onOpenHybrid }: { r: CompareResult; onOpenHybrid: () => void }) {
  return (
    <>
      <Card title="Scores for this pair" subtitle={r.note}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Model</th><th scope="col">What it measures</th><th scope="col" className="num">Match score</th>
                <th scope="col">Category</th><th scope="col" className="num">Percentile within model validation scores</th>
              </tr>
            </thead>
            <tbody>
              {MODEL_NAMES.map((m) => (
                <tr key={m}>
                  <th scope="row"><span className="swatch" style={{ background: MODEL_COLOR[m] }} aria-hidden="true" />{MODEL_LABEL[m]}</th>
                  <td>{MODEL_KIND[m]}</td>
                  <td className="num">{fmt(r[m].score)}</td>
                  <td><CategoryBadge category={r[m].category} /></td>
                  <td className="num">{r[m].validation_percentile.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Position within each model's own validation scores"
            subtitle="Raw scores use different scales (compare the category thresholds on each card), so they are not compared directly. This shows what share of each model's validation pairs scored lower than this pair (0–100).">
        <MetricBars metric="Percentile within model validation scores" domain={[0, 100]} height={240} digits={1}
                    data={MODEL_NAMES.map((m) => ({ name: MODEL_LABEL[m], value: r[m].validation_percentile, color: MODEL_COLOR[m] }))} />
      </Card>
      <div className="grid-3">
        {MODEL_NAMES.map((m) => <ModelCard key={m} result={r[m]} onOpenHybrid={m === "hybrid" ? onOpenHybrid : undefined} />)}
      </div>
      <Disclaimer />
    </>
  );
}

function ModelCard({ result, onOpenHybrid }: { result: MatchResult; onOpenHybrid?: () => void }) {
  const ex = result.explanation;
  return (
    <Card className="model-card">
      <ScoreHeader result={result} compact />
      {result.model === "tfidf" && ex.top_shared_terms && (
        <>
          <h4>Top shared terms</h4>
          <p className="terms">{ex.top_shared_terms.slice(0, 6).map((t) => <code key={t.term}>{t.term}</code>)}</p>
        </>
      )}
      {result.model === "semantic" && <p className="small">{ex.limitations}</p>}
      {result.model === "hybrid" && (
        <>
          <h4>Missing required skills</h4>
          <SkillList items={result.missing_required_skills ?? []} kind="missing" empty="None missing." />
          {ex.gaps && ex.gaps.length > 0 && <p className="small muted">{ex.gaps.join(" · ")}</p>}
          <button className="btn btn-small" onClick={onOpenHybrid}>Open full hybrid breakdown</button>
        </>
      )}
    </Card>
  );
}

function WhyDifferent() {
  return (
    <Card title="Why are the scores different?">
      <dl className="why">
        <div><dt>TF-IDF</dt><dd>Counts shared terminology, weighting rare words more. Different wording for the same skill (“ML” vs “machine learning”) earns no credit.</dd></div>
        <div><dt>BGE Semantic</dt><dd>Compares the meaning of the two texts as a whole, so related wording counts. It has no notion of which requirements are mandatory.</dd></div>
        <div><dt>Skill-Aware Hybrid</dt><dd>Starts from semantic similarity and additionally checks required and preferred skills, estimated years of experience and how well past duties match the job’s responsibilities. Components that cannot be measured are left out rather than counted as zero.</dd></div>
      </dl>
      <p className="muted small">Each model has its own score scale and thresholds, learned on the validation split. That is why the categories and percentiles, not the raw numbers, are the fair basis for comparison.</p>
    </Card>
  );
}
