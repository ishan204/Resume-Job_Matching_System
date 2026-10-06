// Renders exactly what /api/match returned; nothing here computes a model score.
import type { MatchResult as Result } from "../api/types";
import { COMPONENT_LABEL, fmt, MODEL_KIND, MODEL_LABEL } from "../labels";
import { Card, CategoryBadge, Disclaimer, Evidence, Meter, SkillList } from "./ui";

const LEVEL = ["", "High school", "Associate", "Bachelor", "Master", "Doctorate"];
const COMPONENT_HINT: Record<string, string> = {
  semantic_score: "BGE similarity of the whole texts, scaled 0–1 with frozen validation bounds",
  required_skill_coverage: "share of the job's required skills found in the resume",
  preferred_skill_coverage: "share of the job's preferred skills found in the resume",
  experience_match: "estimated years ÷ required years, capped at 100%",
  responsibility_similarity: "job duties vs best-matching experience sentences, scaled 0–1",
};

export function ScoreHeader({ result, compact = false }: { result: Result; compact?: boolean }) {
  return (
    <div className={`score-header ${compact ? "compact" : ""}`}>
      <div>
        <span className="eyebrow">{MODEL_LABEL[result.model]} · {MODEL_KIND[result.model]}</span>
        <div className="score-line">
          <span className="score-value" aria-label={`Match score ${fmt(result.score)}`}>{fmt(result.score)}</span>
          <CategoryBadge category={result.category} />
        </div>
        <span className="muted small">Match score (model score, not a probability)</span>
      </div>
      <dl className="score-meta">
        <div><dt>Percentile within model validation scores</dt><dd>{result.validation_percentile.toFixed(1)}</dd></div>
        <div><dt>Category thresholds (validation)</dt><dd>{result.thresholds.map((t) => fmt(t)).join(" / ")}</dd></div>
      </dl>
    </div>
  );
}

function count(matched?: string[], missing?: string[]) {
  const total = (matched?.length ?? 0) + (missing?.length ?? 0);
  return total ? `${matched?.length ?? 0} of ${total}` : "none detected in the job";
}

export function MatchResultView({ result }: { result: Result }) {
  return (
    <div className="result">
      <Card><ScoreHeader result={result} /></Card>
      {result.model === "hybrid" ? <HybridDetails result={result} /> : <BaselineDetails result={result} />}
      <Disclaimer />
    </div>
  );
}

function BaselineDetails({ result }: { result: Result }) {
  const ex = result.explanation;
  return (
    <Card title="What this score measures">
      <p>{ex.summary}</p>
      {ex.top_shared_terms && ex.top_shared_terms.length > 0 && (
        <>
          <h4>Terms contributing most to the TF-IDF similarity</h4>
          <table className="table compact-table">
            <thead><tr><th scope="col">Shared term</th><th scope="col" className="num">Contribution</th></tr></thead>
            <tbody>
              {ex.top_shared_terms.map((t) => (
                <tr key={t.term}><td><code>{t.term}</code></td><td className="num">{fmt(t.contribution, 4)}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {ex.limitations && <p className="muted small">Limitation: {ex.limitations}</p>}
    </Card>
  );
}

function HybridDetails({ result }: { result: Result }) {
  const ex = result.explanation;
  const c = result.components;
  const exp = result.experience;
  const used = new Set(ex.components_used ?? []);
  return (
    <>
      <div className="grid-2">
        <Card title="Score components" subtitle="Each component is 0–1; components that cannot be measured are left out of the score.">
          {Object.keys(COMPONENT_HINT).map((k) => (
            <Meter key={k} label={COMPONENT_LABEL[k]} value={c[k]}
                   hint={`${COMPONENT_HINT[k]}${used.size && !used.has(k === "semantic_score" ? "semantic_similarity" : k) ? " (not used)" : ""}`} />
          ))}
          {ex.weights && (
            <p className="muted small">
              Weights (frozen, chosen on validation):{" "}
              {Object.entries(ex.weights).map(([k, w]) => `${COMPONENT_LABEL[k] ?? k} ${w}`).join(" · ")}
            </p>
          )}
        </Card>
        <Card title="Why this score?">
          {ex.strengths && ex.strengths.length > 0 && (<><h4>Strengths</h4><SkillList items={ex.strengths} kind="ok" empty="" srPrefix="Strength: " /></>)}
          {ex.gaps && ex.gaps.length > 0 && (<><h4>Gaps</h4><SkillList items={ex.gaps} kind="missing" empty="" srPrefix="Gap: " /></>)}
          <p className="muted small">{ex.summary}</p>
        </Card>
      </div>

      <Card title="Skills" subtitle="Detected with a fixed skill taxonomy; required vs preferred comes from the job's wording and sections.">
        <div className="grid-2">
          <div>
            <h4>Required skills <span className="muted">({count(result.matched_required_skills, result.missing_required_skills)} found)</span></h4>
            {(result.missing_required_skills?.length ?? 0) > 0 && (
              <div className="missing-box" role="group" aria-label="Missing required skills">
                <strong>Missing required</strong>
                <SkillList items={result.missing_required_skills ?? []} kind="missing" empty="" />
              </div>
            )}
            <SkillList items={result.matched_required_skills ?? []} kind="ok" empty="No required skills matched." />
          </div>
          <div>
            <h4>Preferred skills <span className="muted">({count(result.matched_preferred_skills, result.missing_preferred_skills)} found)</span></h4>
            <SkillList items={result.matched_preferred_skills ?? []} kind="ok" empty="No preferred skills matched." />
            {(result.missing_preferred_skills?.length ?? 0) > 0 && (
              <><h5 className="muted">Not found</h5><SkillList items={result.missing_preferred_skills ?? []} kind="neutral" empty="" /></>
            )}
          </div>
        </div>
        {ex.uncertain_job_skills && ex.uncertain_job_skills.length > 0 && (
          <p className="muted small">Mentioned in the job without required/preferred wording (not scored): {ex.uncertain_job_skills.join(", ")}</p>
        )}
        {ex.skill_evidence && Object.keys(ex.skill_evidence).length > 0 && (
          <details className="details">
            <summary>Where each matched skill was found in the resume</summary>
            <ul className="evidence-list">
              {Object.entries(ex.skill_evidence).map(([s, e]) => <li key={s}><strong>{s}:</strong> <Evidence text={e} /></li>)}
            </ul>
          </details>
        )}
        {ex.requirement_evidence && Object.keys(ex.requirement_evidence).length > 0 && (
          <details className="details">
            <summary>Job sentences that define each requirement</summary>
            <ul className="evidence-list">
              {Object.entries(ex.requirement_evidence).map(([s, e]) => <li key={s}><strong>{s}:</strong> <Evidence text={e} /></li>)}
            </ul>
          </details>
        )}
      </Card>

      <div className="grid-2">
        <Card title="Experience" subtitle="Estimated from employment date ranges; overlapping roles counted once.">
          <dl className="kv">
            <div><dt>Estimated experience</dt><dd>{exp?.candidate_years != null ? `${exp.candidate_years.toFixed(1)} years` : "Could not be estimated"}</dd></div>
            <div><dt>Required experience</dt><dd>{exp?.required_years != null ? `${exp.required_years} years` : "Not stated in the job"}</dd></div>
            <div><dt>Experience gap</dt><dd>{exp?.gap_years != null ? (exp.gap_years > 0 ? `${exp.gap_years.toFixed(1)} years short` : "None") : "—"}</dd></div>
          </dl>
          <Meter label="Experience match" value={c.experience_match} hint="estimated ÷ required years, capped at 100%"
                 missingText="Not scored: the job states no years, or experience could not be estimated" />
          {exp?.source === "stated" && <p className="muted small">Estimate taken from a stated “N years of experience”, not from dates.</p>}
          {ex.education && (ex.education.required_level || ex.education.candidate_level) && (
            <p className="muted small">Degree level (not scored): candidate {LEVEL[ex.education.candidate_level ?? 0] || "unknown"}, required {LEVEL[ex.education.required_level ?? 0] || "not stated"}.</p>
          )}
        </Card>
        <Card title="Responsibility alignment" subtitle="Each job duty matched to the most similar sentence from the candidate's experience.">
          <Meter label="Responsibility similarity" value={result.responsibility_similarity} hint="scaled 0–1 with frozen validation bounds" />
          {(ex.responsibility_evidence ?? []).map((e, i) => (
            <div className="evidence-pair" key={i}>
              <div><span className="eyebrow">Job responsibility</span><Evidence text={e.job_responsibility} limit={140} /></div>
              <div className="evidence-arrow" aria-hidden="true">↓</div>
              <div><span className="eyebrow">Candidate evidence · similarity {e.similarity.toFixed(3)}</span><Evidence text={e.candidate_experience} limit={140} /></div>
            </div>
          ))}
          {!ex.responsibility_evidence?.length && <p className="muted small">No responsibility statements could be compared.</p>}
        </Card>
      </div>
    </>
  );
}
