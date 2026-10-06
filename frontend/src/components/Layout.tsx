import { useEffect, useState, type ReactNode } from "react";
import { api } from "../api/client";
import type { Health } from "../api/types";
import { ROUTES, type RoutePath } from "../router";

function ApiStatus() {
  const [health, setHealth] = useState<Health | null>(null);
  const [down, setDown] = useState(false);
  const check = () => {
    setDown(false);
    api.health().then(setHealth, () => {
      setHealth(null);
      setDown(true);
    });
  };
  useEffect(check, []);
  if (down) {
    return (
      <span className="api-status api-down" role="status">
        <span aria-hidden="true">●</span> API unavailable
        <button className="link-btn" onClick={check}>Retry</button>
      </span>
    );
  }
  if (!health) return <span className="api-status" role="status">Checking API…</span>;
  return (
    <span className="api-status api-up" role="status" title={`API version ${health.version}`}>
      <span aria-hidden="true">●</span> API online<span className="api-detail"> · {health.models_loaded ? "3 models loaded" : "models loading"}</span>
    </span>
  );
}

export function Layout({ route, children }: { route: RoutePath; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [route]);
  return (
    <div className="shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="topbar">
        <button className="menu-btn" aria-expanded={menuOpen} aria-controls="nav" onClick={() => setMenuOpen(!menuOpen)}>
          <span aria-hidden="true">☰</span><span className="visually-hidden">Menu</span>
        </button>
        <a className="brand" href="#/dashboard">
          <span className="brand-mark" aria-hidden="true">RJ</span>
          <span>Resume–Job Matching <span className="brand-sub">Research Prototype</span></span>
        </a>
        <ApiStatus />
      </header>
      <nav id="nav" className={`sidebar ${menuOpen ? "open" : ""}`} aria-label="Main">
        <ul>
          {ROUTES.map((r) => (
            <li key={r.path}>
              <a href={`#/${r.path}`} aria-current={route === r.path ? "page" : undefined}>{r.label}</a>
            </li>
          ))}
        </ul>
        <p className="sidebar-note">TF-IDF · BGE · Skill-Aware Hybrid</p>
      </nav>
      <main id="main" className="content" tabIndex={-1}>{children}</main>
    </div>
  );
}
