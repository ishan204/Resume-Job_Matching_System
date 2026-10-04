import React, { useState, useEffect } from 'react';
import {
  Mail,
  Copy,
  Check,
  Download,
  Sparkles,
  Award,
  RefreshCw,
} from 'lucide-react';
import { Resume, JobDescription, CoverLetter, CoverLetterTone } from '@shared';
import { api } from '../api';

interface CoverLetterViewProps {
  resumes: Resume[];
  jobs: JobDescription[];
  initialResumeId?: string;
  initialJobId?: string;
}

export const CoverLetterView: React.FC<CoverLetterViewProps> = ({
  resumes,
  jobs,
  initialResumeId,
  initialJobId,
}) => {
  const [selectedResumeId, setSelectedResumeId] = useState<string>(
    initialResumeId || resumes[0]?.id || ''
  );
  const [selectedJobId, setSelectedJobId] = useState<string>(
    initialJobId || jobs[0]?.id || ''
  );
  const [tone, setTone] = useState<CoverLetterTone>('professional');
  const [isGenerating, setIsGenerating] = useState(false);
  const [coverLetter, setCoverLetter] = useState<CoverLetter | null>(null);
  const [editableText, setEditableText] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!selectedResumeId || !selectedJobId) return;

    try {
      setIsGenerating(true);
      const res = await api.generateCoverLetter(selectedResumeId, selectedJobId, tone);
      setCoverLetter(res);
      setEditableText(res.fullLetter);
    } catch (err: any) {
      alert(err.message || 'Failed to generate cover letter');
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (initialResumeId && initialJobId) {
      setSelectedResumeId(initialResumeId);
      setSelectedJobId(initialJobId);
      handleGenerate();
    }
  }, [initialResumeId, initialJobId]);

  const handleCopy = () => {
    if (!editableText) return;
    navigator.clipboard.writeText(editableText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!editableText) return;
    const blob = new Blob([editableText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Cover_Letter_${coverLetter?.company || 'Company'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tones: { id: CoverLetterTone; label: string; desc: string }[] = [
    { id: 'professional', label: 'Professional', desc: 'Balanced & polished' },
    { id: 'enthusiastic', label: 'Enthusiastic', desc: 'High energy & mission-driven' },
    { id: 'confident', label: 'Confident', desc: 'Direct, results-focused' },
    { id: 'concise', label: 'Concise', desc: 'Short, high-velocity bullet points' },
    { id: 'technical', label: 'Technical', desc: 'System design & architecture focus' },
  ];

  const wordCount = editableText.split(/\s+/).filter(Boolean).length;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            AI Cover Letter Studio
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Synthesize highly personalized, achievement-driven cover letters tailored to the target company and role.
          </p>
        </div>

        {coverLetter && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition-all active:scale-95"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-600 transition-all active:scale-95"
            >
              <Download className="h-4 w-4" />
              <span>Download</span>
            </button>
          </div>
        )}
      </div>

      {/* Configuration Bar */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Candidate Resume
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

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Target Company & Job
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

        {/* Tone Selector Pills */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Tone of Voice
          </label>
          <div className="flex flex-wrap gap-2">
            {tones.map((t) => {
              const isSelected = tone === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTone(t.id)}
                  className={`rounded-xl px-3.5 py-2 text-xs font-medium transition-all text-left ${
                    isSelected
                      ? 'bg-brand-500 text-white shadow-sm'
                      : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  <p className="font-bold">{t.label}</p>
                  <p className={`text-[10px] ${isSelected ? 'text-brand-100' : 'text-slate-400'}`}>
                    {t.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !selectedResumeId || !selectedJobId}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-sky-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-500/20 hover:from-brand-700 hover:to-sky-600 active:scale-95 transition-all disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            <span>{isGenerating ? 'Synthesizing Letter...' : 'Generate Cover Letter'}</span>
          </button>
        </div>
      </div>

      {/* Generated Cover Letter Editor */}
      {coverLetter ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Personalized for {coverLetter.company} — {coverLetter.role}
            </span>
            <span className="font-mono">
              {wordCount} words • ~{Math.ceil(wordCount / 200)} min read
            </span>
          </div>

          <textarea
            rows={14}
            value={editableText}
            onChange={(e) => setEditableText(e.target.value)}
            className="w-full font-serif text-sm text-slate-800 dark:text-slate-200 leading-relaxed bg-transparent border-0 focus:outline-none focus:ring-0 resize-y p-2"
          />

          {coverLetter.highlightedAchievements.length > 0 && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                Key Accomplishments Embedded:
              </span>
              <div className="flex flex-wrap gap-2">
                {coverLetter.highlightedAchievements.map((ach, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1 text-xs text-brand-700 dark:bg-brand-950/40 dark:text-brand-300 border border-brand-200 dark:border-brand-800"
                  >
                    <Award className="h-3 w-3" />
                    <span>{ach}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 p-16 text-center dark:border-slate-800">
          <Mail className="h-14 w-14 text-slate-300 dark:text-slate-700 mb-3" />
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">
            Draft a Tailored Cover Letter
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mt-1">
            Choose your tone and hit <strong>"Generate Cover Letter"</strong> to automatically incorporate your key achievements and company mission alignment.
          </p>
        </div>
      )}
    </div>
  );
};
