// Small, reusable building blocks. Status is always text + icon, never colour alone.
import { useEffect, useState, type ReactNode } from "react";
import { ApiError } from "../api/client";

export function useAsync<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setState({ loading: true });
    load().then(
      (data) => live && setState({ data, loading: false }),
      (e) => live && setState({ error: errorMessage(e), loading: false }),
    );
    return () => {
      live = false;
    };
  }, [...deps, attempt]);
  return { ...state, retry: () => setAttempt((a) => a + 1) };
}

export const errorMessage = (e: unknown) =>
  e instanceof ApiError ? e.message : "Something went wrong. Please try again.";

export function Card({ title, subtitle, children, className = "", actions }: {
  title?: ReactNode; subtitle?: ReactNode; children: ReactNode; className?: string; actions?: ReactNode;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card-head">
          <div>
            {title && <h3>{title}</h3>}
            {subtitle && <p className="muted small">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, lead }: { title: string; lead?: ReactNode }) {
  return (
    <header className="page-header">
      <h1>{title}</h1>
      {lead && <p className="lead">{lead}</p>}
    </header>
  );
}

export function Stat({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
      {note && <span className="stat-note">{note}</span>}
    </div>
  );
}

export function Loading({ text }: { text: string }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      {text}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-box" role="alert">
      <span aria-hidden="true" className="icon-bad">!</span>
      <span>{message}</span>
      {onRetry && <button className="btn btn-small" onClick={onRetry}>Retry</button>}
    </div>
  );
}

export function Disclaimer() {
  return (
    <p className="disclaimer" role="note">
      This is an academic research prototype and should not be used as the sole basis for employment decisions.
    </p>
  );
}

/** Horizontal 0–1 bar with the value printed beside it. */
export function Meter({ label, value, hint, missingText = "Not measurable for this pair" }: {
  label: string; value: number | null | undefined; hint?: string; missingText?: string;
}) {
  const known = value !== null && value !== undefined;
  return (
    <div className="meter">
      <div className="meter-row">
        <span className="meter-label">{label}</span>
        <span className="meter-value">{known ? `${Math.round(value * 100)}%` : "—"}</span>
      </div>
      <div className="meter-track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100}
           aria-valuenow={known ? Math.round(value * 100) : undefined} aria-valuetext={known ? undefined : missingText}>
        {known && <div className="meter-fill" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />}
      </div>
      <span className="meter-hint">{known ? hint : missingText}</span>
    </div>
  );
}

export function SkillList({ items, kind, empty, srPrefix }: {
  items: string[]; kind: "ok" | "missing" | "neutral"; empty: string; srPrefix?: string;
}) {
  if (!items.length) return <p className="muted small">{empty}</p>;
  const icon = kind === "ok" ? "✓" : kind === "missing" ? "!" : "•";
  const prefix = srPrefix ?? (kind === "ok" ? "Matched: " : kind === "missing" ? "Missing: " : "");
  return (
    <ul className={`skills skills-${kind}`}>
      {items.map((s) => (
        <li key={s}>
          <span aria-hidden="true" className="skill-icon">{icon}</span>
          {prefix && <span className="visually-hidden">{prefix}</span>}
          {s}
        </li>
      ))}
    </ul>
  );
}

/** Long evidence strings are shown as returned by the backend, visually truncated with a toggle. */
export function Evidence({ text, limit = 180 }: { text: string; limit?: number }) {
  const [open, setOpen] = useState(false);
  const long = text.length > limit;
  return (
    <span className="evidence">
      <q>{open || !long ? text : `${text.slice(0, limit).trimEnd()}…`}</q>
      {long && (
        <button className="link-btn" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? "Show less" : "View more"}
        </button>
      )}
    </span>
  );
}

export function CategoryBadge({ category }: { category: string }) {
  const tone = category.startsWith("Strong") ? "good" : category.startsWith("Potential") ? "mid" : "weak";
  const icon = tone === "good" ? "▲" : tone === "mid" ? "■" : "▼";
  return (
    <span className={`badge badge-${tone}`}>
      <span aria-hidden="true">{icon}</span> {category}
    </span>
  );
}
