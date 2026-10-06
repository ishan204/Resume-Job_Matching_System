// The only place that talks to the FastAPI backend. Components never call fetch() directly.
import type {
  CompareResult, Demo, Health, MatchResult, ModelName, ParsedJob, ParsedResume,
  ResearchAblation, ResearchModels, ResearchRobustness, ResearchSummary,
} from "./types";

const BASE: string = import.meta.env.VITE_API_BASE ?? "";

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

// Backend error messages are written to be user-safe; only 5xx / network failures get generic text.
function friendly(code: string | undefined, message: string | undefined, status: number): string {
  if (status >= 500) {
    return code === "MODEL_UNAVAILABLE" && message ? message : "The server hit an unexpected problem. Please try again.";
  }
  return message ?? `Request failed (HTTP ${status}).`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, init);
  } catch {
    throw new ApiError("NETWORK", "Cannot reach the analysis server. Check that the backend is running.", 0);
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* empty or non-JSON body handled below */
  }
  if (!res.ok) {
    const err = (body as { error?: { code?: string; message?: string } } | null)?.error;
    if (!err && res.status >= 500) {
      // No API error body: the request never reached FastAPI (e.g. the dev proxy could not connect).
      throw new ApiError("UNREACHABLE", "The analysis server is not responding. Start it with `uvicorn backend.app.main:app --port 8000` (loading models takes about 10–30 s), then try again.", res.status);
    }
    throw new ApiError(err?.code ?? `HTTP_${res.status}`, friendly(err?.code, err?.message, res.status), res.status);
  }
  if (body === null || body === undefined) {
    throw new ApiError("EMPTY", "The server returned an empty response.", res.status);
  }
  return body as T;
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

// Research results are static files on the server: fetch each once per session.
const cache = new Map<string, Promise<unknown>>();
function cached<T>(path: string): Promise<T> {
  if (!cache.has(path)) {
    const p = request<T>(path);
    p.catch(() => cache.delete(path)); // allow retry after a failure
    cache.set(path, p);
  }
  return cache.get(path) as Promise<T>;
}

export const api = {
  health: () => request<Health>("/api/health"),
  demo: () => cached<Demo>("/api/demo"),
  parseResume: (input: File | string) => {
    const form = new FormData();
    if (typeof input === "string") form.append("text", input);
    else form.append("file", input);
    return request<ParsedResume>("/api/parse-resume?include_text=true", { method: "POST", body: form });
  },
  parseJob: (jobDescription: string) => request<ParsedJob>("/api/parse-job", json({ job_description: jobDescription })),
  match: (resume: string, jobDescription: string, model: ModelName) =>
    request<MatchResult>("/api/match", json({ resume, job_description: jobDescription, model })),
  compare: (resume: string, jobDescription: string) =>
    request<CompareResult>("/api/compare", json({ resume, job_description: jobDescription })),
  research: {
    summary: () => cached<ResearchSummary>("/api/research/summary"),
    models: () => cached<ResearchModels>("/api/research/models"),
    ablation: () => cached<ResearchAblation>("/api/research/ablation"),
    robustness: () => cached<ResearchRobustness>("/api/research/robustness"),
  },
};

export function clearCache() {
  cache.clear();
}
