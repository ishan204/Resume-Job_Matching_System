import React from 'react';
import {
  FileText,
  Briefcase,
  Target,
  KanbanSquare,
  ArrowRight,
  TrendingUp,
  CheckCircle2,
  Clock,
  Sparkles,
  Award,
} from 'lucide-react';
import { DashboardStats, Resume, JobDescription } from '@shared';
import { ScoreGauge } from '../components/common/ScoreGauge';
import { ActiveTab } from '../components/layout/Sidebar';

interface DashboardViewProps {
  stats: DashboardStats | null;
  resumes: Resume[];
  jobs: JobDescription[];
  onNavigate: (tab: ActiveTab) => void;
  onQuickMatch: (resumeId: string, jobId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  resumes,
  jobs,
  onNavigate,
  onQuickMatch,
}) => {
  const [selectedResumeId, setSelectedResumeId] = React.useState<string>(resumes[0]?.id || '');
  const [selectedJobId, setSelectedJobId] = React.useState<string>(jobs[0]?.id || '');

  React.useEffect(() => {
    if (!selectedResumeId && resumes.length > 0) setSelectedResumeId(resumes[0].id);
    if (!selectedJobId && jobs.length > 0) setSelectedJobId(jobs[0].id);
  }, [resumes, jobs]);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-brand-950 to-slate-900 p-8 text-white shadow-xl shadow-slate-950/10 border border-slate-800">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-md text-brand-300">
            <Sparkles className="h-3.5 w-3.5" />
            <span>AI Career Acceleration Platform</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Accelerate your career with <span className="bg-gradient-to-r from-brand-400 to-sky-300 bg-clip-text text-transparent">ResumeMatch AI</span>
          </h1>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Upload your resumes, analyze targeted job descriptions, inspect explainable ATS scoring, and tailor your profile for maximum recruiter callbacks.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={() => onNavigate('match')}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/30 transition-all hover:bg-brand-600 active:scale-95"
            >
              <Target className="h-4 w-4" />
              <span>Launch Match Engine</span>
            </button>
            <button
              onClick={() => onNavigate('resumes')}
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-md transition-all hover:bg-white/20 active:scale-95"
            >
              <FileText className="h-4 w-4" />
              <span>Manage Resumes</span>
            </button>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute right-0 top-0 -mt-12 -mr-12 h-80 w-80 rounded-full bg-brand-500/20 blur-3xl pointer-events-none" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Average Match */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Avg. Match Score
            </p>
            <h3 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
              {stats?.averageMatchScore || 82}%
            </h3>
            <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <TrendingUp className="h-3 w-3" />
              <span>+18% after optimization</span>
            </p>
          </div>
          <ScoreGauge score={stats?.averageMatchScore || 82} size={64} strokeWidth={6} showPercent={false} />
        </div>

        {/* Resumes */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Resumes in Studio
            </p>
            <h3 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
              {stats?.totalResumes || resumes.length}
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              All parsed & ATS verified
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400">
            <FileText className="h-6 w-6" />
          </div>
        </div>

        {/* Jobs Analyzed */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Target Job Vault
            </p>
            <h3 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
              {stats?.totalJobs || jobs.length}
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Skill taxonomies extracted
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
            <Briefcase className="h-6 w-6" />
          </div>
        </div>

        {/* Active Pipeline */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              CRM Pipeline
            </p>
            <h3 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
              {stats?.activeApplications || 3} Active
            </h3>
            <p className="mt-1 flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 font-medium">
              <Award className="h-3 w-3" />
              <span>{stats?.offersCount || 1} Offer, {stats?.interviewsCount || 1} Interview</span>
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
            <KanbanSquare className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Quick Match Studio Launcher & Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Quick Match Card */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Instant Match Analysis
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pair an existing resume with a job posting to generate an explainable score.
              </p>
            </div>
            <button
              onClick={() => onNavigate('match')}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 flex items-center gap-1"
            >
              <span>Advanced Studio</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Select Candidate Resume
              </label>
              <select
                value={selectedResumeId}
                onChange={(e) => setSelectedResumeId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {resumes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title} ({r.parsedData.skills.length} skills)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Select Target Job
              </label>
              <select
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title} at {j.company}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => {
                if (selectedResumeId && selectedJobId) {
                  onQuickMatch(selectedResumeId, selectedJobId);
                }
              }}
              disabled={!selectedResumeId || !selectedJobId}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-sky-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-500/20 hover:from-brand-700 hover:to-sky-600 active:scale-95 disabled:opacity-50"
            >
              <Target className="h-4 w-4" />
              <span>Calculate Explainable Match</span>
            </button>
          </div>
        </div>

        {/* Activity Stream */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-4 w-4 text-slate-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Recent Activity
            </h2>
          </div>

          <div className="space-y-3">
            {stats?.recentActivities && stats.recentActivities.length > 0 ? (
              stats.recentActivities.map((act) => (
                <div key={act.id} className="flex items-start gap-3 rounded-xl border border-slate-100 p-2.5 dark:border-slate-800/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {act.title}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {new Date(act.timestamp).toLocaleDateString()} at {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">No recent activities recorded.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
