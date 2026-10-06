// Frontend tests. fetch is replaced by a router serving REAL responses captured from the backend
// (src/test/fixtures), so the real API client, state and pages are exercised without FastAPI running.
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearCache } from "../api/client";
import { App } from "../App";
import ablation from "./fixtures/ablation.json";
import compare from "./fixtures/compare.json";
import demo from "./fixtures/demo.json";
import health from "./fixtures/health.json";
import matchHybrid from "./fixtures/match_hybrid.json";
import matchTfidf from "./fixtures/match_tfidf.json";
import models from "./fixtures/models.json";
import robustness from "./fixtures/robustness.json";
import summary from "./fixtures/summary.json";

type Handler = (body: unknown, init?: RequestInit) => Response | Promise<Response>;
const ok = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { "Content-Type": "application/json" } });
const parsed = { ...{ text: "Python developer resume", skills: [{ skill: "Python", category: "programming", evidence: "Python developer" }],
  education: [], highest_degree: "Bachelor", experience: { total_years: 4, source: "dates", date_ranges_found: 1, stated_years: null, statements: [] },
  projects: [], certifications: [], notes: [] } };

let routes: Record<string, Handler>;
let calls: { path: string; init?: RequestInit }[];

beforeEach(() => {
  clearCache();
  window.location.hash = "";
  calls = [];
  routes = {
    "/api/health": () => ok(health),
    "/api/demo": () => ok(demo),
    "/api/research/summary": () => ok(summary),
    "/api/research/models": () => ok(models),
    "/api/research/ablation": () => ok(ablation),
    "/api/research/robustness": () => ok(robustness),
    "/api/parse-resume": () => ok(parsed),
    "/api/match": (b) => ok((b as { model: string }).model === "tfidf" ? matchTfidf : matchHybrid),
    "/api/compare": () => ok(compare),
  };
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const path = url.split("?")[0];
    calls.push({ path, init });
    const handler = routes[path];
    if (!handler) return new Response(null, { status: 404 });
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : init?.body;
    return handler(body, init);
  }));
});
afterEach(() => vi.unstubAllGlobals());

const go = async (path: string) => {
  await act(async () => {
    window.location.hash = `/${path}`;
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
};
const count = (path: string) => calls.filter((c) => c.path === path).length;

async function loadDemoAndAnalyze(user: ReturnType<typeof userEvent.setup>) {
  await go("match");
  await user.click(await screen.findByRole("button", { name: "Load Demo" }));
  await waitFor(() => expect(screen.getByLabelText("Job description text")).toHaveValue(demo.job_description));
  await user.click(screen.getByRole("button", { name: "Analyze Match" }));
}

describe("dashboard and navigation", () => {
  it("renders research facts and the finding from the API", async () => {
    render(<App />);
    expect(await screen.findByText("Unique resumes")).toBeInTheDocument();
    expect(screen.getByText(String(summary.dataset.unique_resumes))).toBeInTheDocument();
    expect(screen.getByText(String(summary.dataset.unique_jobs))).toBeInTheDocument();
    expect(screen.getByText("Repeated grouped evaluations")).toBeInTheDocument();
    const finding = screen.getByText(/achieved the strongest ranking performance/);
    expect(finding).toHaveTextContent("Skill-Aware Hybrid");
    expect(finding).toHaveTextContent("BGE Semantic retained the strongest average classification macro F1");
    expect(screen.getByRole("link", { name: "Analyze a Resume" })).toHaveAttribute("href", "#/match");
    expect(screen.queryByText(/accuracy/i)).toBeNull();          // no score is presented as "accuracy"
  });

  it("navigates between pages and marks the current page", async () => {
    render(<App />);
    await go("research");
    expect(await screen.findByRole("heading", { name: "Research results" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Research" })).toHaveAttribute("aria-current", "page");
    await go("about");
    expect(await screen.findByText(/Student-designed improvement: Skill-Aware Hybrid/)).toBeInTheDocument();
  });

  it("shows API status and toggles the mobile menu", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByText(/API online/)).toBeInTheDocument();
    const menu = screen.getByRole("button", { name: "Menu" });
    expect(menu).toHaveAttribute("aria-expanded", "false");
    await user.click(menu);
    expect(menu).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById("nav")).toHaveClass("open");
  });
});

describe("match analysis", () => {
  it("loads the synthetic demo into both inputs", async () => {
    const user = userEvent.setup();
    render(<App />);
    await go("match");
    await user.click(await screen.findByRole("button", { name: "Load Demo" }));
    await waitFor(() => expect(screen.getByLabelText(/Resume text/)).toHaveValue(demo.resume));
    expect(screen.getByLabelText("Job description text")).toHaveValue(demo.job_description);
  });

  it("uploads a resume file and rejects unsupported types without calling the API", async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<App />);
    await go("match");
    const input = await screen.findByLabelText(/Upload resume file/);
    await user.upload(input, new File(["Python developer resume"], "cv.txt", { type: "text/plain" }));
    expect(await screen.findByText(/cv\.txt/)).toBeInTheDocument();
    expect(screen.getByText(/1 skills detected/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Resume text/)).toHaveValue("Python developer resume");
    expect(calls.find((c) => c.path === "/api/parse-resume")?.init?.body).toBeInstanceOf(FormData);
    await user.upload(input, new File(["MZ"], "tool.exe"));
    expect(await screen.findByText(/Unsupported file type/)).toBeInTheDocument();
    expect(count("/api/parse-resume")).toBe(1);
  });

  it("runs only the selected model", async () => {
    const user = userEvent.setup();
    render(<App />);
    await go("match");
    await user.click(await screen.findByRole("button", { name: "Load Demo" }));
    await waitFor(() => expect(screen.getByLabelText("Job description text")).toHaveValue(demo.job_description));
    await user.click(screen.getByLabelText(/TF-IDF/));
    await user.click(screen.getByRole("button", { name: "Analyze Match" }));
    expect(await screen.findByText("Terms contributing most to the TF-IDF similarity")).toBeInTheDocument();
    const req = calls.filter((c) => c.path === "/api/match");
    expect(req).toHaveLength(1);
    expect(JSON.parse(String(req[0].init?.body)).model).toBe("tfidf");
    expect(count("/api/compare")).toBe(0);
    expect(screen.queryByText("Missing required")).toBeNull();     // no hybrid-only fields for TF-IDF
  });

  it("renders the hybrid result with score, category, components and evidence", async () => {
    const user = userEvent.setup();
    render(<App />);
    await loadDemoAndAnalyze(user);
    expect(await screen.findByText(matchHybrid.score.toFixed(3))).toBeInTheDocument();
    expect(screen.getAllByText(matchHybrid.category).length).toBeGreaterThan(0);
    expect(screen.getByText("Match score (model score, not a probability)")).toBeInTheDocument();
    expect(screen.getByText("Percentile within model validation scores")).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "Required skill coverage" })).toHaveAttribute("aria-valuenow", "57");
    expect(screen.getByText(`${matchHybrid.experience.candidate_years.toFixed(1)} years`)).toBeInTheDocument();
    expect(screen.getAllByText(matchHybrid.explanation.responsibility_evidence[0].job_responsibility.slice(0, 40), { exact: false }).length).toBeGreaterThan(0);
    expect(screen.getByRole("note")).toHaveTextContent("academic research prototype");
  });

  it("makes missing required skills prominent and non-colour-only", async () => {
    const user = userEvent.setup();
    render(<App />);
    await loadDemoAndAnalyze(user);
    const box = await screen.findByRole("group", { name: "Missing required skills" });
    for (const s of matchHybrid.missing_required_skills) expect(within(box).getByText(s)).toBeInTheDocument();
    expect(within(box).getAllByText("Missing:", { exact: false }).length).toBe(matchHybrid.missing_required_skills.length);
  });

  it("shows a loading state while the model runs", async () => {
    let release!: (r: Response) => void;
    routes["/api/match"] = () => new Promise<Response>((res) => { release = res; });
    const user = userEvent.setup();
    render(<App />);
    await loadDemoAndAnalyze(user);
    expect(await screen.findByText("Running hybrid analysis…")).toBeInTheDocument();
    await act(async () => release(ok(matchHybrid)));
    expect(await screen.findByText(matchHybrid.score.toFixed(3))).toBeInTheDocument();
  });

  it("validates empty inputs before calling the API", async () => {
    const user = userEvent.setup();
    render(<App />);
    await go("match");
    await user.click(await screen.findByRole("button", { name: "Analyze Match" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Add a resume first");
    expect(count("/api/match")).toBe(0);
  });
});

describe("errors", () => {
  it("shows backend validation messages, never raw internals", async () => {
    routes["/api/match"] = () => new Response(JSON.stringify({ error: { code: "INVALID_INPUT", message: "job_description: Job description text cannot be empty." } }), { status: 422 });
    const user = userEvent.setup();
    render(<App />);
    await loadDemoAndAnalyze(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("Job description text cannot be empty.");
  });

  it("explains an unreachable backend and an unexpected server error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    const { unmount } = render(<App />);
    expect(await screen.findByText(/Cannot reach the analysis server/)).toBeInTheDocument();
    expect(await screen.findByText(/API unavailable/)).toBeInTheDocument();
    unmount();
    clearCache();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "Traceback (most recent call last)" } }), { status: 500 })));
    render(<App />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("unexpected problem");
    expect(alert).not.toHaveTextContent("Traceback");
  });
});

describe("comparison and research", () => {
  it("compares all three models once per input and labels percentiles carefully", async () => {
    const user = userEvent.setup();
    render(<App />);
    await loadDemoAndAnalyze(user);
    await screen.findByText(matchHybrid.score.toFixed(3));
    await user.click(screen.getByRole("button", { name: "Compare Models" }));
    const table = await screen.findByRole("table");
    for (const m of ["tfidf", "semantic", "hybrid"] as const) {
      expect(within(table).getByText(compare[m].score.toFixed(3))).toBeInTheDocument();
    }
    expect(within(table).getByText("Percentile within model validation scores")).toBeInTheDocument();
    expect(screen.getByText(/not calibrated probabilities/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Why are the scores different?" })).toBeInTheDocument();
    await go("research");
    await go("compare");
    await screen.findByRole("table");
    expect(count("/api/compare")).toBe(1);                         // unchanged inputs are not re-compared
  });

  it("shows research metrics, robustness, ablation and limitations from the API", async () => {
    render(<App />);
    await go("research");
    const leak = summary.dataset.original_split_leakage;
    expect(await screen.findByText(`${leak.also_in_original_train} of ${leak.original_test_resumes} resumes in the supplied test split also appear in its train split.`)).toBeInTheDocument();
    const served = models.rows.find((r) => r.model === "hybrid_parserfix")!;
    const ndcg = `${(served["repeated_mean_ndcg@10"] as number).toFixed(3)} ± ${(served["repeated_std_ndcg@10"] as number).toFixed(3)}`;
    expect(screen.getByText(ndcg)).toBeInTheDocument();
    expect(screen.getByText(/The two objectives disagree/)).toBeInTheDocument();
    expect(screen.getAllByText("lower in every view").length).toBeGreaterThan(0);   // ablation is not "everything improved"
    const diff = robustness.differences.find((d) => d.comparison === "hybrid - semantic" && d.metric === "ndcg@10")!;
    expect(screen.getByText(`[+${diff.ci95_low.toFixed(3)}, +${diff.ci95_high.toFixed(3)}]`)).toBeInTheDocument();
    for (const l of summary.limitations) expect(screen.getByText(l)).toBeInTheDocument();
  });
});
