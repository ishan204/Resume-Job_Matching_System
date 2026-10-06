import { useRef, useState, type DragEvent } from "react";
import { api } from "../api/client";
import { useAppState } from "../state";
import { ErrorBox, Loading, errorMessage } from "./ui";

const ACCEPT = ".pdf,.docx,.txt";

export function useLoadDemo() {
  const { setResume, setJob } = useAppState();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await api.demo();
      setResume(d.resume, "demo resume (synthetic)");
      setJob(d.job_description);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };
  return { load, loading, error };
}

export function ResumeInput() {
  const { resume, resumeFile, parsedResume, setResume } = useAppState();
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handle = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!/\.(pdf|docx|txt)$/i.test(file.name)) {
      setError("Unsupported file type. Please upload a PDF, DOCX or TXT file.");
      return;
    }
    setParsing(true);
    try {
      const parsed = await api.parseResume(file);
      setResume(parsed.text ?? "", file.name, parsed);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    handle(e.dataTransfer.files?.[0]);
  };

  return (
    <section className="input-panel" aria-labelledby="resume-h">
      <h2 id="resume-h">Resume</h2>
      <div className={`dropzone ${drag ? "drag" : ""}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
           onDragLeave={() => setDrag(false)} onDrop={onDrop} data-testid="dropzone">
        <p><strong>Drop a resume here</strong> or</p>
        <button type="button" className="btn btn-small" onClick={() => fileRef.current?.click()}>Choose file</button>
        <input ref={fileRef} type="file" accept={ACCEPT} className="visually-hidden" aria-label="Upload resume file (PDF, DOCX or TXT)"
               onChange={(e) => handle(e.target.files?.[0])} />
        <p className="muted small">PDF, DOCX or TXT · up to 5 MB · processed in memory, never stored</p>
      </div>
      {parsing && <Loading text="Parsing resume…" />}
      {error && <ErrorBox message={error} />}
      {resumeFile && !parsing && (
        <p className="file-chip"><span aria-hidden="true">📄</span> {resumeFile}
          {parsedResume && (
            <span className="muted"> · {parsedResume.skills.length} skills detected
              {parsedResume.experience.total_years != null && ` · ~${parsedResume.experience.total_years.toFixed(1)} years (estimated)`}
              {parsedResume.highest_degree && ` · ${parsedResume.highest_degree}`}
            </span>
          )}
        </p>
      )}
      <label htmlFor="resume-text" className="field-label">Resume text <span className="muted">(paste or edit)</span></label>
      <textarea id="resume-text" rows={12} value={resume} placeholder="Paste resume text here, or upload a file above."
                onChange={(e) => setResume(e.target.value, resumeFile, null)} />
    </section>
  );
}

export function JobInput() {
  const { job, setJob } = useAppState();
  return (
    <section className="input-panel" aria-labelledby="job-h">
      <h2 id="job-h">Job description</h2>
      <label htmlFor="job-text" className="field-label">Job description text</label>
      <textarea id="job-text" rows={19} value={job} placeholder="Paste the job description here."
                onChange={(e) => setJob(e.target.value)} />
    </section>
  );
}
