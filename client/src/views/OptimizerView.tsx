import React, { useState, useEffect } from 'react';
import {
  Wand2,
  Copy,
  Check,
  Download,
  ArrowRight,
  Sparkles,
  FileText,
  Briefcase,
  Diff,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { Resume, JobDescription, OptimizedResume } from '@shared';
import { api } from '../api';

interface OptimizerViewProps {
  resumes: Resume[];
  jobs: JobDescription[];
  initialMatchId?: string;
  initialResumeId?: string;
  initialJobId?: string;
}

export const OptimizerView: React.FC<OptimizerViewProps> = ({
  resumes,
  jobs,
  initialMatchId,
  initialResumeId,
  initialJobId,
}) => {
  const [selectedResumeId, setSelectedResumeId] = useState<string>(
    initialResumeId || resumes[0]?.id || ''
  );
  const [selectedJobId, setSelectedJobId] = useState<string>(
    initialJobId || jobs[0]?.id || ''
  );
  const [isTailoring, setIsTailoring] = useState(false);
  const [optimizedData, setOptimizedData] = useState<OptimizedResume | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'diff' | 'full'>('diff');

  const handleTailor = async () => {
    if (!selectedResumeId || !selectedJobId) return;

    try {
      setIsTailoring(true);
      // 1. Calculate match first to ensure MatchAnalysis exists
      const match = await api.calculateMatch(selectedResumeId, selectedJobId);
      // 2. Generate optimized resume
      const optimized = await api.optimizeResume(match.id, selectedResumeId, selectedJobId);
      setOptimizedData(optimized);
    } catch (err: any) {
      alert(err.message || 'Failed to tailor resume');
    } finally {
      setIsTailoring(false);
    }
  };

  useEffect(() => {
    if (initialResumeId && initialJobId) {
      setSelectedResumeId(initialResumeId);
      setSelectedJobId(initialJobId);
      handleTailor();
    }
  }, [initialResumeId, initialJobId]);

  const handleCopy = () => {
    if (!optimizedData) return;
    navigator.clipboard.writeText(optimizedData.fullOptimizedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!optimizedData) return;
    const blob = new Blob([optimizedData.fullOptimizedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Tailored_Resume_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Resume Tailor Studio
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Automatically restructure resume bullets using Google's XYZ formula and weave targeted keywords into your summary.
          </p>
        </div>

        {optimizedData && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition-all active:scale-95"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              <span>{copied ? 'Copied!' : 'Copy Full Text'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-600 transition-all active:scale-95"
            >
              <Download className="h-4 w-4" />
              <span>Export</span>
            </button>
          </div>
        )}
      </div>

      {/* Target Selector */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 items-end">
        <div className="md:col-span-5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Original Resume
          </label>
          <select
            value={selectedResumeId}
            onChange={(e) => setSelectedResumeId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {resumes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Target Job Description
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

        <div className="md:col-span-2">
          <button
            onClick={handleTailor}
            disabled={isTailoring || !selectedResumeId || !selectedJobId}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-sky-500 py-2.5 px-4 text-sm font-semibold text-white shadow-md shadow-brand-500/20 hover:from-brand-700 hover:to-sky-600 active:scale-95 transition-all disabled:opacity-50"
          >
            <Wand2 className="h-4 w-4" />
            <span>{isTailoring ? 'Tailoring...' : 'Tailor Now'}</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      {optimizedData ? (
        <div className="space-y-6">
          {/* Tailored Professional Summary */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                <span>AI-Tailored Professional Summary</span>
              </h3>
              <span className="text-[11px] text-slate-400">Target Role Aligned</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed bg-brand-50/40 dark:bg-brand-950/20 p-4 rounded-xl border border-brand-100 dark:border-brand-900/40">
              {optimizedData.tailoredSummary}
            </p>
          </div>

          {/* View Mode Toggle */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 gap-4">
            <button
              onClick={() => setActiveTab('diff')}
              className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'diff'
                  ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              <Diff className="h-4 w-4" />
              <span>Interactive Bullet Point Diff Viewer ({optimizedData.optimizedBullets.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('full')}
              className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'full'
                  ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              <FileText className="h-4 w-4" />
              <span>Full Formatted Document</span>
            </button>
          </div>

          {activeTab === 'diff' ? (
            <div className="space-y-4">
              {optimizedData.optimizedBullets.map((diff, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3"
                >
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{diff.company}</span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] dark:bg-slate-800">
                      Bullet #{i + 1}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {/* Before */}
                    <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-3.5 dark:border-rose-900/30 dark:bg-rose-950/20">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                        Original Bullet
                      </span>
                      <p className="mt-1 text-slate-700 dark:text-slate-300 leading-relaxed">
                        {diff.originalBullet}
                      </p>
                    </div>

                    {/* After */}
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3.5 dark:border-emerald-900/30 dark:bg-emerald-950/20">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        Tailored (Google XYZ Formula)
                      </span>
                      <p className="mt-1 text-slate-800 dark:text-slate-100 font-medium leading-relaxed">
                        {diff.optimizedBullet}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span className="italic">{diff.reason}</span>
                    {diff.targetKeywordsAdded && diff.targetKeywordsAdded.length > 0 && (
                      <span className="font-mono text-emerald-600 dark:text-emerald-400">
                        + Keywords: {diff.targetKeywordsAdded.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {/* Suggested Skill Additions */}
              {optimizedData.suggestedSkillAdditions.length > 0 && (
                <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Recommended Skill Placements
                  </h3>
                  <div className="space-y-2">
                    {optimizedData.suggestedSkillAdditions.map((item, idx) => (
                      <div key={idx} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/40">
                        <span className="font-bold text-slate-900 dark:text-white">{item.skill}</span>
                        <p className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5">{item.rationale}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <pre className="whitespace-pre-wrap font-sans text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                {optimizedData.fullOptimizedText}
              </pre>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 p-16 text-center dark:border-slate-800">
          <Wand2 className="h-14 w-14 text-slate-300 dark:text-slate-700 mb-3" />
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">
            Ready to Tailor Your Resume
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mt-1">
            Select your resume and target job above, then click <strong>"Tailor Now"</strong> to generate quantifiable Google XYZ bullet points.
          </p>
        </div>
      )}
    </div>
  );
};
