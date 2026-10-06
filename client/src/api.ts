import {
  Resume,
  JobDescription,
  MatchAnalysis,
  OptimizedResume,
  CoverLetter,
  CoverLetterTone,
  Application,
  ApplicationStatus,
  DashboardStats
} from '@shared';

const API_BASE = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data?.error?.message || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data.data;
}

export const api = {
  // Health
  getHealth: async () => {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
  },

  // Dashboard Stats
  getStats: () => fetchJson<DashboardStats>('/stats'),

  // Resumes
  getResumes: () => fetchJson<Resume[]>('/resumes'),
  getResume: (id: string) => fetchJson<Resume>(`/resumes/${id}`),
  deleteResume: async (id: string) => {
    const res = await fetch(`${API_BASE}/resumes/${id}`, { method: 'DELETE' });
    return res.json();
  },
  uploadResumeFile: async (file: File, title?: string): Promise<Resume> => {
    const formData = new FormData();
    formData.append('resume', file);
    if (title) formData.append('title', title);

    const res = await fetch(`${API_BASE}/resumes/upload`, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || 'Upload failed');
    return data.data;
  },
  createResumeFromText: (title: string, text: string) =>
    fetchJson<Resume>('/resumes/text', {
      method: 'POST',
      body: JSON.stringify({ title, text }),
    }),

  // Job Descriptions
  getJobs: () => fetchJson<JobDescription[]>('/jobs'),
  getJob: (id: string) => fetchJson<JobDescription>(`/jobs/${id}`),
  deleteJob: async (id: string) => {
    const res = await fetch(`${API_BASE}/jobs/${id}`, { method: 'DELETE' });
    return res.json();
  },
  createJob: (job: {
    title: string;
    company: string;
    location?: string;
    employmentType?: string;
    salaryRange?: string;
    rawText: string;
  }) =>
    fetchJson<JobDescription>('/jobs', {
      method: 'POST',
      body: JSON.stringify(job),
    }),

  // Matching
  calculateMatch: (resumeId: string, jobId: string) =>
    fetchJson<MatchAnalysis>('/match', {
      method: 'POST',
      body: JSON.stringify({ resumeId, jobId }),
    }),
  getMatch: (id: string) => fetchJson<MatchAnalysis & { resumeTitle: string; jobTitle: string; company: string }>(`/match/${id}`),

  // Optimization
  optimizeResume: (matchAnalysisId: string, resumeId: string, targetJobId: string) =>
    fetchJson<OptimizedResume>('/optimize', {
      method: 'POST',
      body: JSON.stringify({ matchAnalysisId, resumeId, targetJobId }),
    }),
  getOptimizedResume: (id: string) => fetchJson<OptimizedResume>(`/optimize/${id}`),

  // Cover Letter
  generateCoverLetter: (resumeId: string, jobId: string, tone: CoverLetterTone) =>
    fetchJson<CoverLetter>('/cover-letters/generate', {
      method: 'POST',
      body: JSON.stringify({ resumeId, jobId, tone }),
    }),
  updateCoverLetter: (id: string, fullLetter: string) =>
    fetchJson<CoverLetter>(`/cover-letters/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ fullLetter }),
    }),

  // Applications CRM
  getApplications: () => fetchJson<Application[]>('/applications'),
  createApplication: (app: {
    company: string;
    position: string;
    location?: string;
    salary?: string;
    status?: ApplicationStatus;
    resumeId?: string;
    jobId?: string;
    matchScore?: number;
    notes?: string;
    nextActionDate?: string;
  }) =>
    fetchJson<Application>('/applications', {
      method: 'POST',
      body: JSON.stringify(app),
    }),
  updateApplicationStatus: (id: string, status: ApplicationStatus, note?: string) =>
    fetchJson<Application>(`/applications/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, note }),
    }),
};
