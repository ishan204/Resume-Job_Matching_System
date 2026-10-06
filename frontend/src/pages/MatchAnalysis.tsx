import { useState } from "react";
import { api } from "../api/client";
import { MODEL_NAMES, type ModelName } from "../api/types";
import { JobInput, ResumeInput, useLoadDemo } from "../components/Inputs";
import { MatchResultView } from "../components/MatchResult";
import { ErrorBox, Loading, PageHeader, errorMessage } from "../components/ui";
import { MODEL_KIND, MODEL_LABEL } from "../labels";
import { navigate } from "../router";
import { useAppState } from "../state";

const RUNNING: Record<ModelName, string> = {
  tfidf: "Running TF-IDF model…",
  semantic: "Running semantic model…",
  hybrid: "Running hybrid analysis…",
};

export function inputProblem(resume: string, job: string): string | null {
  if (!resume.trim()) return "Add a resume first: upload a file, paste text, or load the demo.";
  if (!job.trim()) return "Add a job description before analysing.";
  return null;
}

export function MatchAnalysis() {
  const { resume, job, model, setModel, match, setMatch, key } = useAppState();
  const demo = useLoadDemo();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = async () => {
    const problem = inputProblem(resume, job);
    if (problem) return setError(problem);
    setError(null);
    setRunning(true);
    try {
      setMatch({ key, value: await api.match(resume, job, model) }); // only the selected model is run
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setRunning(false);
    }
  };

  const compare = () => {
    const problem = inputProblem(resume, job);
    if (problem) return setError(problem);
    navigate("compare");
  };

  const stale = match && match.key !== key;
  return (
    <>
      <PageHeader title="Match Analysis"
                  lead="Score one resume against one job description with a single model and see why it scored that way." />
      <div className="toolbar">
        <button className="btn" onClick={demo.load} disabled={demo.loading}>{demo.loading ? "Loading demo…" : "Load Demo"}</button>
        <span className="muted small">Synthetic resume and job description provided by the backend.</span>
      </div>
      {demo.error && <ErrorBox message={demo.error} />}

      <div className="grid-2 inputs">
        <ResumeInput />
        <JobInput />
      </div>

      <div className="action-bar">
        <fieldset className="model-select">
          <legend>Model</legend>
          {MODEL_NAMES.map((m) => (
            <label key={m} className={`radio ${model === m ? "checked" : ""}`}>
              <input type="radio" name="model" value={m} checked={model === m} onChange={() => setModel(m)} />
              <span><strong>{MODEL_LABEL[m]}</strong><span className="muted small">{MODEL_KIND[m]}</span></span>
            </label>
          ))}
        </fieldset>
        <div className="action-buttons">
          <button className="btn btn-primary" onClick={analyze} disabled={running}>Analyze Match</button>
          <button className="btn" onClick={compare} disabled={running}>Compare Models</button>
        </div>
      </div>

      {error && <ErrorBox message={error} />}
      {running && <Loading text={RUNNING[model]} />}
      {match && !running && (
        <>
          {stale && <p className="stale" role="status">The inputs have changed since this result was computed. Run the analysis again to update it.</p>}
          <h2 className="section-title">Result</h2>
          <MatchResultView result={match.value} />
        </>
      )}
    </>
  );
}
