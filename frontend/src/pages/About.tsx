import { api } from "../api/client";
import { Card, Disclaimer, ErrorBox, Loading, PageHeader, useAsync } from "../components/ui";

export function About() {
  const { data, error, loading, retry } = useAsync(() => api.research.summary());
  return (
    <>
      <PageHeader title="About / Limitations" />
      <Card title="Project purpose">
        <p>An undergraduate AI Lab research project asking whether combining semantic similarity with explicit skill coverage,
          experience compatibility and responsibility alignment improves resume–job matching over lexical TF-IDF and pure
          semantic matching, while keeping every score explainable.</p>
      </Card>
      <Card title="Student-designed improvement: Skill-Aware Hybrid Resume–Job Matching">
        <p className="formula">semantic similarity + explicit skill coverage + experience compatibility + responsibility alignment</p>
        <p>The hybrid keeps the transformer's semantic score and adds explicit, requirement-aware features extracted with
          deterministic rules (no LLM). Components that cannot be measured are left out instead of counted as zero, and every
          score comes with its evidence: matched and missing skills, the experience gap and the best-matching duties.</p>
        <p className="muted small">This is a student-designed system improvement for this project, not a claim of scientific novelty.
          Hybrid scoring and skill matching are established ideas; the contribution is this design and its honest evaluation.</p>
      </Card>
      <Card title="Technology">
        <ul className="tech">
          <li><strong>ML:</strong> Python, scikit-learn (TF-IDF), sentence-transformers (BGE), pandas</li>
          <li><strong>Backend:</strong> FastAPI, serving the frozen research models</li>
          <li><strong>Frontend:</strong> React, TypeScript, Vite, Recharts</li>
        </ul>
      </Card>
      {loading && <Loading text="Loading limitations…" />}
      {error && <ErrorBox message={error} onRetry={retry} />}
      {data && (
        <Card title="Research limitations">
          <ul className="limitations">{data.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
          <p className="muted small">Explanation faithfulness was checked on {data.explainability_check.pairs_checked.toLocaleString()} test pairs:{" "}
            {data.explainability_check.all_checks_pass_for_all_pairs ? "all checks passed for every pair" : "some checks failed"}.
            This shows the explanations match the model's own features. It does not show the extracted skills are always correct.</p>
        </Card>
      )}
      <Card title="Privacy and fairness">
        <ul className="limitations">
          <li>Uploaded resumes are processed in memory and are not stored; server logs contain no resume or job text.</li>
          <li>No protected or personal attributes are used as features: no name, age, gender, race, religion, nationality, marital status, photo or address.</li>
          <li>Degree requirements can still carry indirect bias, which is one reason education is not part of the score.</li>
        </ul>
        <Disclaimer />
      </Card>
    </>
  );
}
