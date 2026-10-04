import React, { useState } from 'react';
import {
  FileText,
  UploadCloud,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Trash2,
  Eye,
  Plus,
  ArrowRight,
  Sparkles,
  Briefcase,
  GraduationCap,
  Award,
  ExternalLink,
  Target,
} from 'lucide-react';
import { Resume } from '@shared';
import { ScoreGauge } from '../components/common/ScoreGauge';
import { SkillBadge } from '../components/common/SkillBadge';
import { api } from '../api';

interface ResumesViewProps {
  resumes: Resume[];
  onRefresh: () => Promise<void>;
  onSelectForMatch: (resumeId: string) => void;
}

export const ResumesView: React.FC<ResumesViewProps> = ({
  resumes,
  onRefresh,
  onSelectForMatch,
}) => {
  const [selectedResume, setSelectedResume] = useState<Resume | null>(resumes[0] || null);
  const [isUploading, setIsUploading] = useState(false);
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // File upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setErrorMessage(null);
      const newResume = await api.uploadResumeFile(file);
      await onRefresh();
      setSelectedResume(newResume);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to upload resume file.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  // Paste text handler
  const handlePasteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pasteText.trim()) return;

    try {
      setIsUploading(true);
      setErrorMessage(null);
      const newResume = await api.createResumeFromText(pasteTitle || 'New Resume', pasteText);
      await onRefresh();
      setSelectedResume(newResume);
      setPasteModalOpen(false);
      setPasteText('');
      setPasteTitle('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to parse resume text.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this resume?')) return;
    try {
      await api.deleteResume(id);
      await onRefresh();
      if (selectedResume?.id === id) {
        setSelectedResume(resumes.find(r => r.id !== id) || null);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Resume Studio
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Upload resumes in PDF, DOCX, or text format to extract skills, experience, and ATS compliance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-md shadow-brand-500/20 hover:bg-brand-600 active:scale-95 transition-all">
            <UploadCloud className="h-4 w-4" />
            <span>{isUploading ? 'Parsing Document...' : 'Upload PDF / DOCX'}</span>
            <input
              type="file"
              accept=".pdf,.docx,.doc,.txt"
              onChange={handleFileUpload}
              disabled={isUploading}
              className="hidden"
            />
          </label>

          <button
            onClick={() => setPasteModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>Paste Text</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs sm:text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
          {errorMessage}
        </div>
      )}

      {/* Main Studio View (Split Screen) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Resumes List */}
        <div className="lg:col-span-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
            Uploaded Profiles ({resumes.length})
          </p>

          <div className="space-y-2">
            {resumes.map((resume) => {
              const isSelected = selectedResume?.id === resume.id;
              return (
                <div
                  key={resume.id}
                  onClick={() => setSelectedResume(resume)}
                  className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                    isSelected
                      ? 'border-brand-500 bg-brand-50/40 shadow-sm dark:border-brand-500 dark:bg-brand-950/30'
                      : 'border-slate-200/80 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="overflow-hidden">
                        <h3 className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                          {resume.title}
                        </h3>
                        <p className="text-[11px] text-slate-400 truncate">
                          {resume.parsedData.contactInfo.name || 'Candidate'} • {resume.parsedData.detectedExperienceYears}+ yrs exp
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        resume.atsAnalysis.overallAtsScore >= 80
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                      }`}>
                        {resume.atsAnalysis.overallAtsScore}% ATS
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                    <span>{resume.parsedData.skills.length} skills detected</span>
                    <span>{new Date(resume.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Selected Resume Details */}
        <div className="lg:col-span-8">
          {selectedResume ? (
            <div className="space-y-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              {/* Header Details */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-slate-100 dark:border-slate-800 gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                      {selectedResume.parsedData.contactInfo.name || selectedResume.title}
                    </h2>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300 font-mono">
                      {selectedResume.fileName}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {selectedResume.parsedData.contactInfo.email} • {selectedResume.parsedData.contactInfo.phone} • {selectedResume.parsedData.contactInfo.location}
                  </p>
                  {(selectedResume.parsedData.contactInfo.linkedin || selectedResume.parsedData.contactInfo.github) && (
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-brand-600 dark:text-brand-400 font-medium">
                      {selectedResume.parsedData.contactInfo.linkedin && (
                        <a href={selectedResume.parsedData.contactInfo.linkedin} target="_blank" rel="noreferrer" className="hover:underline flex items-center gap-1">
                          <span>LinkedIn</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {selectedResume.parsedData.contactInfo.github && (
                        <a href={selectedResume.parsedData.contactInfo.github} target="_blank" rel="noreferrer" className="hover:underline flex items-center gap-1">
                          <span>GitHub</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onSelectForMatch(selectedResume.id)}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-brand-600 active:scale-95 transition-all"
                  >
                    <Target className="h-4 w-4" />
                    <span>Match with Job</span>
                  </button>

                  <button
                    onClick={() => handleDelete(selectedResume.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-rose-500 hover:bg-rose-50 dark:border-slate-800 dark:hover:bg-rose-950/40"
                    title="Delete Resume"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* ATS Compatibility Breakdown Card */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5 dark:border-slate-800/80 dark:bg-slate-800/40">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-5">
                    <ScoreGauge score={selectedResume.atsAnalysis.overallAtsScore} size={84} strokeWidth={8} label="ATS Score" />
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        Applicant Tracking System (ATS) Health
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Word Count: <strong>{selectedResume.atsAnalysis.wordCount}</strong> • Est. Length: <strong>~{selectedResume.atsAnalysis.pageCountEstimate} page(s)</strong>
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Keyword Density: <strong>{selectedResume.atsAnalysis.keywordDensity}%</strong>
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full md:w-auto">
                    {selectedResume.atsAnalysis.formattingChecks.map((chk, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-xs dark:bg-slate-900 shadow-2xs border border-slate-100 dark:border-slate-800">
                        {chk.passed ? (
                          <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                        ) : chk.severity === 'error' ? (
                          <XCircle className="h-4 w-4 text-rose-500 shrink-0" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                        )}
                        <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                          {chk.rule}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Professional Summary */}
              {selectedResume.parsedData.summary && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                    Professional Summary
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed rounded-xl bg-slate-50/50 p-4 border border-slate-100 dark:border-slate-800 dark:bg-slate-800/20">
                    {selectedResume.parsedData.summary}
                  </p>
                </div>
              )}

              {/* Categorized Skills */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
                  Extracted Skills Taxonomy ({selectedResume.parsedData.skills.length})
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {selectedResume.parsedData.skills.map((skill) => (
                    <SkillBadge key={skill} skill={skill} variant="neutral" />
                  ))}
                </div>
              </div>

              {/* Work Experience */}
              {selectedResume.parsedData.experience.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Work Experience
                  </h3>
                  <div className="space-y-4">
                    {selectedResume.parsedData.experience.map((exp) => (
                      <div key={exp.id} className="rounded-xl border border-slate-100 p-4 dark:border-slate-800/80 dark:bg-slate-800/20 space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                            {exp.title} <span className="text-brand-600 dark:text-brand-400 font-normal">at {exp.company}</span>
                          </h4>
                          <span className="text-xs text-slate-400 font-medium">
                            {exp.startDate || '2021'} – {exp.endDate || 'Present'}
                          </span>
                        </div>

                        <ul className="list-disc list-inside space-y-1 text-xs text-slate-600 dark:text-slate-300">
                          {exp.bullets.map((b, idx) => (
                            <li key={idx} className="leading-relaxed">
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>

                        {exp.detectedSkills.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {exp.detectedSkills.map((s) => (
                              <span key={s} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-400 font-mono">
                                {s}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Education & Certs */}
              {selectedResume.parsedData.education.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                    Education & Credentials
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedResume.parsedData.education.map((edu) => (
                      <div key={edu.id} className="rounded-xl border border-slate-100 p-3 dark:border-slate-800/80">
                        <p className="font-semibold text-xs text-slate-900 dark:text-white">{edu.degree}</p>
                        <p className="text-xs text-slate-500">{edu.institution} {edu.year ? `(${edu.year})` : ''}</p>
                        {edu.gpa && <p className="text-[11px] text-slate-400 mt-1">GPA: {edu.gpa}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 p-12 text-center dark:border-slate-800">
              <FileText className="h-12 w-12 text-slate-400 mb-3" />
              <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300">
                No Resume Selected
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Upload your resume or pick from the left to inspect parsed sections and ATS scores.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Paste Resume Modal */}
      {pasteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-scaleUp">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
              Paste Resume Content
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Paste plain text or markdown directly. We will extract contact details, skills, and compute ATS metrics.
            </p>

            <form onSubmit={handlePasteSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Resume Title / Version Label
                </label>
                <input
                  type="text"
                  placeholder="e.g. Senior Full-Stack Resume 2026"
                  value={pasteTitle}
                  onChange={(e) => setPasteTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Resume Plain Text
                </label>
                <textarea
                  rows={10}
                  placeholder="Paste your full resume text here..."
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  required
                  className="w-full font-mono text-xs rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPasteModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !pasteText.trim()}
                  className="rounded-xl bg-brand-500 px-5 py-2 text-xs font-semibold text-white shadow-md shadow-brand-500/20 hover:bg-brand-600 disabled:opacity-50"
                >
                  {isUploading ? 'Parsing...' : 'Save & Analyze'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
