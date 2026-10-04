import React, { useState, useEffect } from 'react';
import {
  Target,
  FileText,
  Briefcase,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Wand2,
  Mail,
  PlusCircle,
  HelpCircle,
  TrendingUp,
  Award,
  BookOpen,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Resume, JobDescription, MatchAnalysis } from '@shared';
import { ScoreGauge } from '../components/common/ScoreGauge';
import { SkillBadge } from '../components/common/SkillBadge';
import { api } from '../api';

interface MatchViewProps {
  resumes: Resume[];
  jobs: JobDescription[];
  initialResumeId?: string;
  initialJobId?: string;
  onNavigateToOptimize: (matchAnalysisId: string, resumeId: string, jobId: string) => void;
  onNavigateToCoverLetter: (resumeId: string, jobId: string) => void;
  onTrackInCrm: (company: string, position: string, matchScore: number, resumeId: string, jobId: string) => void;
}

export const MatchView: React.FC<MatchViewProps> = ({
  resumes,
  jobs,
  initialResumeId,
  initialJobId,
  onNavigateToOptimize,
  onNavigateToCoverLetter,
  onTrackInCrm,
}) => {
  const [selectedResumeId, setSelectedResumeId] = useState<string>(
    initialResumeId || resumes[0]?.id || ''
  );
  const [selectedJobId, setSelectedJobId] = useState<string>(
    initialJobId || jobs[0]?.id || ''
  );
  const [isCalculating, setIsCalculating] = useState(false);
  const [analysis, setAnalysis] = useState<MatchAnalysis | null>(null);
  const [activeSkillTab, setActiveSkillTab] = useState<'matched' | 'missing-critical' | 'missing-bonus' | 'bonus'>('matched');

  // Trigger match calculation
  const handleCalculateMatch = async (resId?: string, jId?: string) => {
    const rId = resId || selectedResumeId;
    const jIdTarget = jId || selectedJobId;
    if (!rId || !jIdTarget) return;

    try {
      setIsCalculating(true);
      const res = await api.calculateMatch(rId, jIdTarget);
      setAnalysis(res);

      if (res.overallScore >= 80) {
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 },
        });
      }
    } catch (err: any) {
      alert(err.message || 'Failed to calculate match');
    } finally {
      setIsCalculating(false);
    }
  };

  useEffect(() => {
    if (initialResumeId) setSelectedResumeId(initialResumeId);
    if (initialJobId) setSelectedJobId(initialJobId);
    if (initialResumeId && initialJobId) {
      handleCalculateMatch(initialResumeId, initialJobId);
    }
  }, [initialResumeId, initialJobId]);

  const selectedResume = resumes.find(r => r.id === selectedResumeId);
  const selectedJob = jobs.find(j => j.id === selectedJobId);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Explainable Match Engine
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Transparent multi-dimensional scoring evaluating technical skills, seniority threshold, responsibilities alignment, and ATS readiness.
        </p>
      </div>

      {/* Selectors Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 items-end">
        <div className="md:col-span-5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Select Resume Profile
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

        <div className="md:col-span-5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Select Target Job Posting
          </label>
          <select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title} at {j.company} ({j.parsedData.requiredSkills.length} req. skills)
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <button
            onClick={() => handleCalculateMatch()}
            disabled={isCalculating || !selectedResumeId || !selectedJobId}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 px-4 text-sm font-semibold text-white shadow-md shadow-brand-500/20 hover:bg-brand-600 active:scale-95 transition-all disabled:opacity-50"
          >
            <Target className="h-4 w-4" />
            <span>{isCalculating ? 'Evaluating...' : 'Match'}</span>
          </button>
        </div>
      </div>

      {/* Match Results Display */}
      {analysis ? (
        <div className="space-y-6">
          {/* Main Score & Multi-factor Breakdown */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Radial Gauge */}
              <div className="lg:col-span-4 flex flex-col items-center justify-center text-center p-4 border-b lg:border-b-0 lg:border-r border-slate-100 dark:border-slate-800">
                <ScoreGauge score={analysis.overallScore} size={150} strokeWidth={12} label="Match Score" />
                <div className="mt-3">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {analysis.overallScore >= 80
                      ? 'Exceptional Alignment'
                      : analysis.overallScore >= 65
                      ? 'Moderate Match'
                      : 'Significant Skill Gaps'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
                    {analysis.overallScore >= 80
                      ? 'Strong candidate fit. Proceed directly with tailored application and cover letter.'
                      : analysis.overallScore >= 65
                      ? 'Solid foundation. Use Resume Tailor to address missing critical keywords.'
                      : 'High gap in required technologies. Highlight transferable achievements.'}
                  </p>
                </div>
              </div>

              {/* Explainable Factor Weights */}
              <div className="lg:col-span-8 space-y-4">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Explainable Scoring Model Breakdown
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Calculated using canonical skill mapping, seniority matrices, and TF-IDF semantic overlap.
                  </p>
                </div>

                <div className="space-y-3">
                  {/* Hard Skills */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                      <span>1. Hard Skills Alignment (Weight 40%)</span>
                      <span className="font-mono">{analysis.scoreBreakdown.hardSkillsScore}%</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-brand-500 transition-all duration-1000"
                        style={{ width: `${analysis.scoreBreakdown.hardSkillsScore}%` }}
                      />
                    </div>
                  </div>

                  {/* Experience */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                      <span>2. Seniority & Experience Years (Weight 25%)</span>
                      <span className="font-mono">{analysis.scoreBreakdown.experienceScore}%</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-500 transition-all duration-1000"
                        style={{ width: `${analysis.scoreBreakdown.experienceScore}%` }}
                      />
                    </div>
                  </div>

                  {/* Responsibilities */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                      <span>3. Responsibilities & Domain Overlap (Weight 20%)</span>
                      <span className="font-mono">{analysis.scoreBreakdown.responsibilitiesScore}%</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-purple-500 transition-all duration-1000"
                        style={{ width: `${analysis.scoreBreakdown.responsibilitiesScore}%` }}
                      />
                    </div>
                  </div>

                  {/* Education */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                      <span>4. Education & Qualifications (Weight 10%)</span>
                      <span className="font-mono">{analysis.scoreBreakdown.educationScore}%</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-sky-500 transition-all duration-1000"
                        style={{ width: `${analysis.scoreBreakdown.educationScore}%` }}
                      />
                    </div>
                  </div>

                  {/* ATS Formatting */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                      <span>5. ATS Friendliness & Readability (Weight 5%)</span>
                      <span className="font-mono">{analysis.scoreBreakdown.atsFormattingScore}%</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-1000"
                        style={{ width: `${analysis.scoreBreakdown.atsFormattingScore}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Action Bar */}
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div className="text-xs text-slate-500">
                Next steps: Optimize your resume bullets or draft an AI-customized cover letter.
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => onNavigateToOptimize(analysis.id, analysis.resumeId, analysis.jobId)}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-sky-500 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-md shadow-brand-500/20 hover:from-brand-700 hover:to-sky-600 active:scale-95 transition-all"
                >
                  <Wand2 className="h-4 w-4" />
                  <span>Tailor Resume</span>
                </button>

                <button
                  onClick={() => onNavigateToCoverLetter(analysis.resumeId, analysis.jobId)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all"
                >
                  <Mail className="h-4 w-4" />
                  <span>Generate Cover Letter</span>
                </button>

                {selectedJob && (
                  <button
                    onClick={() =>
                      onTrackInCrm(
                        selectedJob.company,
                        selectedJob.title,
                        analysis.overallScore,
                        analysis.resumeId,
                        analysis.jobId
                      )
                    }
                    className="inline-flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-4 py-2 text-xs sm:text-sm font-semibold text-purple-700 hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300 dark:hover:bg-purple-900/60 active:scale-95 transition-all"
                  >
                    <PlusCircle className="h-4 w-4" />
                    <span>Track in CRM</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Interactive Skill Matrix */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
              Interactive Skill Matrix & Gap Analysis
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Explore matched competencies versus critical requirements that must be bridged.
            </p>

            {/* Matrix Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 gap-4 mb-4">
              <button
                onClick={() => setActiveSkillTab('matched')}
                className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeSkillTab === 'matched'
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Matched Skills ({analysis.skillMatrix.matchedSkills.length})</span>
              </button>

              <button
                onClick={() => setActiveSkillTab('missing-critical')}
                className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeSkillTab === 'missing-critical'
                    ? 'border-rose-500 text-rose-600 dark:text-rose-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                }`}
              >
                <XCircle className="h-3.5 w-3.5" />
                <span>Missing Required ({analysis.skillMatrix.missingRequiredSkills.length})</span>
              </button>

              <button
                onClick={() => setActiveSkillTab('missing-bonus')}
                className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeSkillTab === 'missing-bonus'
                    ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                }`}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Missing Preferred ({analysis.skillMatrix.missingPreferredSkills.length})</span>
              </button>

              <button
                onClick={() => setActiveSkillTab('bonus')}
                className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeSkillTab === 'bonus'
                    ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Candidate Bonus ({analysis.skillMatrix.bonusSkills.length})</span>
              </button>
            </div>

            {/* Tab Contents */}
            <div className="pt-2">
              {activeSkillTab === 'matched' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {analysis.skillMatrix.matchedSkills.map((m) => (
                      <SkillBadge key={m.skill} skill={m.skill} category={m.category} variant="matched" />
                    ))}
                  </div>
                  {analysis.skillMatrix.matchedSkills.some(m => m.contextFound) && (
                    <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800/40 dark:text-slate-400 space-y-1">
                      <p className="font-semibold text-slate-700 dark:text-slate-300">Proof in Resume:</p>
                      {analysis.skillMatrix.matchedSkills.filter(m => m.contextFound).slice(0, 3).map((m, i) => (
                        <p key={i} className="italic text-[11px] truncate">
                          • {m.skill}: {m.contextFound}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeSkillTab === 'missing-critical' && (
                <div className="space-y-4">
                  {analysis.skillMatrix.missingRequiredSkills.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {analysis.skillMatrix.missingRequiredSkills.map((m) => (
                          <SkillBadge key={m.skill} skill={m.skill} category={m.category} variant="missing-critical" />
                        ))}
                      </div>

                      <div className="space-y-2 mt-3">
                        {analysis.skillMatrix.missingRequiredSkills.map((m, i) => (
                          <div key={i} className="rounded-xl border border-rose-100 bg-rose-50/50 p-3 text-xs dark:border-rose-900/40 dark:bg-rose-950/20">
                            <span className="font-bold text-rose-700 dark:text-rose-300">Missing: {m.skill}</span>
                            <p className="text-slate-600 dark:text-slate-300 mt-0.5">{m.recommendation}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold py-2">
                      ✓ No missing core requirements! Your technical profile covers all required skills.
                    </p>
                  )}
                </div>
              )}

              {activeSkillTab === 'missing-bonus' && (
                <div className="space-y-3">
                  {analysis.skillMatrix.missingPreferredSkills.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {analysis.skillMatrix.missingPreferredSkills.map((m) => (
                        <SkillBadge key={m.skill} skill={m.skill} category={m.category} variant="missing-bonus" />
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 py-2">No missing preferred skills.</p>
                  )}
                </div>
              )}

              {activeSkillTab === 'bonus' && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500 mb-2">
                    Skills you possess that were not requested in the job description:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.skillMatrix.bonusSkills.map((skill) => (
                      <SkillBadge key={skill} skill={skill} variant="neutral" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Strengths, Experience Comparison & Actionable Checklist */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Experience Assessment & Strengths */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Experience & Seniority Fit
                </h3>
                <p className="text-xs text-slate-700 dark:text-slate-300 mt-2 leading-relaxed">
                  {analysis.experienceComparison.assessment}
                </p>
              </div>

              <div className="pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                  Verified Candidate Strengths
                </h4>
                <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  {analysis.strengths.map((str, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{str}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {analysis.gaps.length > 0 && (
                <div className="pt-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-500 mb-2">
                    Identified Gaps
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    {analysis.gaps.map((gap, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
                        <span>{gap}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Actionable Advice */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Actionable Optimization Checklist
              </h3>
              <div className="space-y-3 pt-1">
                {analysis.actionableAdvice.map((adv, i) => (
                  <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 text-xs dark:border-slate-800 dark:bg-slate-800/30 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-white">{adv.title}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                        adv.priority === 'high' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {adv.priority}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                      {adv.description}
                    </p>
                    {adv.exampleSnippet && (
                      <p className="mt-1.5 font-mono text-[10px] text-brand-600 dark:text-brand-400 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                        {adv.exampleSnippet}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 p-16 text-center dark:border-slate-800">
          <Target className="h-14 w-14 text-slate-300 dark:text-slate-700 mb-3" />
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">
            No Match Analysis Generated Yet
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mt-1">
            Pick a candidate resume and a target job from above, then click <strong>"Match"</strong> to run the explainable scoring engine.
          </p>
        </div>
      )}
    </div>
  );
};
