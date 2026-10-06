import React, { useState } from 'react';
import {
  Briefcase,
  Plus,
  Trash2,
  Target,
  Building,
  MapPin,
  DollarSign,
  Clock,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { JobDescription } from '@shared';
import { SkillBadge } from '../components/common/SkillBadge';
import { api } from '../api';

interface JobsViewProps {
  jobs: JobDescription[];
  onRefresh: () => Promise<void>;
  onSelectForMatch: (jobId: string) => void;
}

export const JobsView: React.FC<JobsViewProps> = ({
  jobs,
  onRefresh,
  onSelectForMatch,
}) => {
  const [selectedJob, setSelectedJob] = useState<JobDescription | null>(jobs[0] || null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [location, setLocation] = useState('Remote');
  const [salaryRange, setSalaryRange] = useState('');
  const [rawText, setRawText] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !company || !rawText) return;

    try {
      setIsSubmitting(true);
      const newJob = await api.createJob({
        title,
        company,
        location,
        salaryRange,
        rawText,
      });
      await onRefresh();
      setSelectedJob(newJob);
      setCreateModalOpen(false);
      setTitle('');
      setCompany('');
      setRawText('');
    } catch (err: any) {
      alert(err.message || 'Failed to create job');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this job description?')) return;
    try {
      await api.deleteJob(id);
      await onRefresh();
      if (selectedJob?.id === id) {
        setSelectedJob(jobs.find(j => j.id !== id) || null);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Preset sample templates
  const applyTemplate = (preset: 'stripe' | 'anthropic' | 'google') => {
    if (preset === 'stripe') {
      setTitle('Senior Full-Stack Engineer');
      setCompany('Stripe');
      setLocation('San Francisco, CA (Remote)');
      setSalaryRange('$165,000 - $210,000');
      setRawText(`Senior Full-Stack Engineer at Stripe
About the Role:
Build and scale mission-critical APIs and intuitive user interfaces that power internet commerce for millions of global businesses.

Responsibilities:
• Architect, build, and maintain performant web applications using TypeScript, React, and Node.js.
• Write observable, resilient microservices and optimize PostgreSQL database schemas.
• Drive high code quality and mentor junior engineers.

Requirements:
• 5+ years of full-stack engineering experience.
• Strong proficiency in TypeScript, React, Node.js, and PostgreSQL.
• Experience with Docker, AWS or GCP, and CI/CD pipelines.

Nice to have:
• Experience with Go, Kafka, or event-driven systems.
• Background in FinTech and payments compliance.`);
    } else if (preset === 'anthropic') {
      setTitle('Lead AI Platform Engineer');
      setCompany('Anthropic');
      setLocation('San Francisco, CA');
      setSalaryRange('$220,000 - $290,000');
      setRawText(`Lead AI Platform Engineer at Anthropic
Responsibilities:
• Build high-throughput low-latency inference serving infrastructure for frontier LLM models.
• Architect distributed data pipelines with Python, Go, Kubernetes, and Kafka.
• Scale GPU orchestration and cloud infrastructure across AWS.

Requirements:
• 7+ years of software engineering experience with distributed systems.
• High proficiency in Python, Go, Kubernetes, Docker, and Linux.
• Deep understanding of distributed systems and messaging queues.`);
    } else {
      setTitle('Cloud Solutions Architect');
      setCompany('Google');
      setLocation('Sunnyvale, CA');
      setSalaryRange('$190,000 - $240,000');
      setRawText(`Cloud Solutions Architect at Google
Responsibilities:
• Design scalable enterprise cloud architecture on Google Cloud Platform.
• Guide clients through Kubernetes, microservices migrations, and security compliance.

Requirements:
• 6+ years designing large-scale distributed architectures.
• Hands-on mastery of GCP, Kubernetes, Terraform, and Python.
• Strong stakeholder communication and system design skills.`);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Job Description Vault
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Store and analyze target job descriptions to extract required skills, experience thresholds, and responsibilities.
          </p>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-md shadow-brand-500/20 hover:bg-brand-600 active:scale-95 transition-all"
        >
          <Plus className="h-4 w-4" />
          <span>Add Target Job</span>
        </button>
      </div>

      {/* Grid: List + Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* List of Jobs */}
        <div className="lg:col-span-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
            Saved Postings ({jobs.length})
          </p>

          <div className="space-y-2">
            {jobs.map((job) => {
              const isSelected = selectedJob?.id === job.id;
              return (
                <div
                  key={job.id}
                  onClick={() => setSelectedJob(job)}
                  className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                    isSelected
                      ? 'border-brand-500 bg-brand-50/40 shadow-sm dark:border-brand-500 dark:bg-brand-950/30'
                      : 'border-slate-200/80 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="overflow-hidden">
                      <h3 className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                        {job.title}
                      </h3>
                      <p className="text-xs text-brand-600 dark:text-brand-400 font-medium truncate mt-0.5">
                        {job.company}
                      </p>
                    </div>

                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300 uppercase">
                      {job.parsedData.seniorityLevel}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                    <span>{job.parsedData.requiredSkills.length} required skills</span>
                    <span>{job.location}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Job Details */}
        <div className="lg:col-span-8">
          {selectedJob ? (
            <div className="space-y-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-slate-100 dark:border-slate-800 gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    {selectedJob.title}
                  </h2>
                  <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200">
                      <Building className="h-3.5 w-3.5 text-slate-400" />
                      {selectedJob.company}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      {selectedJob.location}
                    </span>
                    {selectedJob.salaryRange && (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                        <DollarSign className="h-3.5 w-3.5" />
                        {selectedJob.salaryRange}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onSelectForMatch(selectedJob.id)}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-brand-600 active:scale-95 transition-all"
                  >
                    <Target className="h-4 w-4" />
                    <span>Match with Resume</span>
                  </button>

                  <button
                    onClick={() => handleDelete(selectedJob.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-rose-500 hover:bg-rose-50 dark:border-slate-800 dark:hover:bg-rose-950/40"
                    title="Delete Job"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Requirement Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Target Seniority</span>
                  <p className="text-sm font-bold text-slate-900 dark:text-white capitalize mt-0.5">
                    {selectedJob.parsedData.seniorityLevel} Level
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Minimum Experience</span>
                  <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                    {selectedJob.parsedData.minYearsExperience}+ Years
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Tech Skills</span>
                  <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                    {selectedJob.parsedData.requiredSkills.length + selectedJob.parsedData.preferredSkills.length} Identified
                  </p>
                </div>
              </div>

              {/* Required Hard Skills */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                  Required Core Skills ({selectedJob.parsedData.requiredSkills.length})
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {selectedJob.parsedData.requiredSkills.map((skill) => (
                    <SkillBadge key={skill} skill={skill} variant="neutral" />
                  ))}
                </div>
              </div>

              {/* Preferred / Nice to Have Skills */}
              {selectedJob.parsedData.preferredSkills.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                    Preferred / Nice-to-Have Skills ({selectedJob.parsedData.preferredSkills.length})
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedJob.parsedData.preferredSkills.map((skill) => (
                      <SkillBadge key={skill} skill={skill} variant="missing-bonus" />
                    ))}
                  </div>
                </div>
              )}

              {/* Key Responsibilities */}
              {selectedJob.parsedData.keyResponsibilities.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                    Key Responsibilities
                  </h3>
                  <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                    {selectedJob.parsedData.keyResponsibilities.map((resp, i) => (
                      <li key={i} className="leading-relaxed">
                        <span>{resp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Full Raw Description Toggle */}
              <div>
                <details className="group rounded-xl border border-slate-100 bg-slate-50/40 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/30">
                  <summary className="cursor-pointer font-semibold text-slate-600 dark:text-slate-300">
                    View Complete Raw Job Description Text
                  </summary>
                  <pre className="mt-3 whitespace-pre-wrap font-sans text-xs text-slate-600 dark:text-slate-400">
                    {selectedJob.rawText}
                  </pre>
                </details>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 p-12 text-center dark:border-slate-800">
              <Briefcase className="h-12 w-12 text-slate-400 mb-3" />
              <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300">
                No Job Selected
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Add a target job description or choose one from the left to inspect requirements.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add Job Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto animate-scaleUp">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
              Add Target Job Description
            </h2>
            <p className="text-xs text-slate-500 mb-3">
              Paste a job posting from LinkedIn, Indeed, or Greenhouse. We will automatically parse required skills and experience levels.
            </p>

            {/* Quick Template Fill Buttons */}
            <div className="flex items-center gap-2 mb-4 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
              <span className="text-[11px] font-semibold text-slate-500 shrink-0">Sample Presets:</span>
              <button
                type="button"
                onClick={() => applyTemplate('stripe')}
                className="rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-100 dark:bg-slate-700 dark:text-slate-200"
              >
                Stripe Full-Stack
              </button>
              <button
                type="button"
                onClick={() => applyTemplate('anthropic')}
                className="rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-100 dark:bg-slate-700 dark:text-slate-200"
              >
                Anthropic AI Platform
              </button>
              <button
                type="button"
                onClick={() => applyTemplate('google')}
                className="rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-100 dark:bg-slate-700 dark:text-slate-200"
              >
                Google Cloud
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Job Title *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Senior Full-Stack Engineer"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Stripe"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Location / Work Model
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Remote or San Francisco, CA"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Salary Range (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. $165,000 - $210,000"
                    value={salaryRange}
                    onChange={(e) => setSalaryRange(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Job Description Text *
                </label>
                <textarea
                  rows={8}
                  placeholder="Paste complete job description requirements here..."
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  required
                  className="w-full font-mono text-xs rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !rawText.trim()}
                  className="rounded-xl bg-brand-500 px-5 py-2 text-xs font-semibold text-white shadow-md shadow-brand-500/20 hover:bg-brand-600 disabled:opacity-50"
                >
                  {isSubmitting ? 'Extracting Requirements...' : 'Save & Analyze'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
