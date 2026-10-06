// App-wide state kept deliberately small: the current inputs and the results computed from them.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { CompareResult, MatchResult, ModelName, ParsedResume } from "./api/types";

/** Results remember the exact inputs they were computed from, so stale results are detectable. */
export interface Keyed<T> {
  key: string;
  value: T;
}

export const inputKey = (resume: string, job: string) => `${resume.length}:${job.length}:${resume}\u0000${job}`;

interface AppState {
  resume: string;
  resumeFile: string | null;
  parsedResume: ParsedResume | null;
  job: string;
  model: ModelName;
  match: Keyed<MatchResult> | null;
  compare: Keyed<CompareResult> | null;
  setResume: (text: string, fileName?: string | null, parsed?: ParsedResume | null) => void;
  setJob: (text: string) => void;
  setModel: (m: ModelName) => void;
  setMatch: (v: Keyed<MatchResult> | null) => void;
  setCompare: (v: Keyed<CompareResult> | null) => void;
  key: string;
}

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [resume, setResumeText] = useState("");
  const [resumeFile, setResumeFile] = useState<string | null>(null);
  const [parsedResume, setParsedResume] = useState<ParsedResume | null>(null);
  const [job, setJob] = useState("");
  const [model, setModel] = useState<ModelName>("hybrid");
  const [match, setMatch] = useState<Keyed<MatchResult> | null>(null);
  const [compare, setCompare] = useState<Keyed<CompareResult> | null>(null);

  const setResume = useCallback((text: string, fileName: string | null = null, parsed: ParsedResume | null = null) => {
    setResumeText(text);
    setResumeFile(fileName);
    setParsedResume(parsed);
  }, []);

  const key = inputKey(resume, job);
  const value = useMemo(
    () => ({ resume, resumeFile, parsedResume, job, model, match, compare, setResume, setJob, setModel, setMatch, setCompare, key }),
    [resume, resumeFile, parsedResume, job, model, match, compare, setResume, key],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAppState must be used inside AppStateProvider");
  return v;
}
