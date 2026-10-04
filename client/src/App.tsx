import React, { useState, useEffect } from 'react';
import { Resume, JobDescription, Application, DashboardStats } from '@shared';
import { Navbar } from './components/layout/Navbar';
import { Sidebar, ActiveTab } from './components/layout/Sidebar';
import { DashboardView } from './views/DashboardView';
import { ResumesView } from './views/ResumesView';
import { JobsView } from './views/JobsView';
import { MatchView } from './views/MatchView';
import { OptimizerView } from './views/OptimizerView';
import { CoverLetterView } from './views/CoverLetterView';
import { ApplicationsView } from './views/ApplicationsView';
import { api } from './api';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [resumes, setResumes] = useState<Resume[]>([]);
  const [jobs, setJobs] = useState<JobDescription[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Workflow bridge state
  const [matchContext, setMatchContext] = useState<{
    resumeId?: string;
    jobId?: string;
    matchAnalysisId?: string;
  }>({});

  // Sync dark mode class
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Initial data loading
  const loadData = async () => {
    try {
      const [resumesData, jobsData, appsData, statsData, healthData] = await Promise.all([
        api.getResumes(),
        api.getJobs(),
        api.getApplications(),
        api.getStats(),
        api.getHealth(),
      ]);

      setResumes(resumesData);
      setJobs(jobsData);
      setApplications(appsData);
      setStats(statsData);
      setHealth(healthData);
    } catch (err) {
      console.error('Failed to load initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Quick match navigation handler
  const handleQuickMatch = (resumeId: string, jobId: string) => {
    setMatchContext({ resumeId, jobId });
    setActiveTab('match');
  };

  // Navigate to optimizer with match context
  const handleNavigateToOptimize = (matchAnalysisId: string, resumeId: string, jobId: string) => {
    setMatchContext({ matchAnalysisId, resumeId, jobId });
    setActiveTab('optimizer');
  };

  // Navigate to cover letter with context
  const handleNavigateToCoverLetter = (resumeId: string, jobId: string) => {
    setMatchContext({ resumeId, jobId });
    setActiveTab('cover-letters');
  };

  // Track in CRM directly
  const handleTrackInCrm = async (
    company: string,
    position: string,
    matchScore: number,
    resumeId: string,
    jobId: string
  ) => {
    try {
      await api.createApplication({
        company,
        position,
        matchScore,
        resumeId,
        jobId,
        status: 'applied',
        notes: `Application generated from ResumeMatch AI match analysis (${matchScore}% match score).`
      });
      await loadData();
      setActiveTab('applications');
    } catch (err: any) {
      alert(err.message || 'Failed to track application');
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            Initializing ResumeMatch AI...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <Navbar
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        systemStatus={health?.status || 'healthy'}
        aiProvider={health?.services?.aiProvider || 'Semantic Engine'}
      />

      <div className="flex flex-1">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          resumesCount={resumes.length}
          jobsCount={jobs.length}
          appsCount={applications.length}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {activeTab === 'dashboard' && (
            <DashboardView
              stats={stats}
              resumes={resumes}
              jobs={jobs}
              onNavigate={setActiveTab}
              onQuickMatch={handleQuickMatch}
            />
          )}

          {activeTab === 'resumes' && (
            <ResumesView
              resumes={resumes}
              onRefresh={loadData}
              onSelectForMatch={(rId) => {
                setMatchContext({ ...matchContext, resumeId: rId });
                setActiveTab('match');
              }}
            />
          )}

          {activeTab === 'jobs' && (
            <JobsView
              jobs={jobs}
              onRefresh={loadData}
              onSelectForMatch={(jId) => {
                setMatchContext({ ...matchContext, jobId: jId });
                setActiveTab('match');
              }}
            />
          )}

          {activeTab === 'match' && (
            <MatchView
              resumes={resumes}
              jobs={jobs}
              initialResumeId={matchContext.resumeId}
              initialJobId={matchContext.jobId}
              onNavigateToOptimize={handleNavigateToOptimize}
              onNavigateToCoverLetter={handleNavigateToCoverLetter}
              onTrackInCrm={handleTrackInCrm}
            />
          )}

          {activeTab === 'optimizer' && (
            <OptimizerView
              resumes={resumes}
              jobs={jobs}
              initialMatchId={matchContext.matchAnalysisId}
              initialResumeId={matchContext.resumeId}
              initialJobId={matchContext.jobId}
            />
          )}

          {activeTab === 'cover-letters' && (
            <CoverLetterView
              resumes={resumes}
              jobs={jobs}
              initialResumeId={matchContext.resumeId}
              initialJobId={matchContext.jobId}
            />
          )}

          {activeTab === 'applications' && (
            <ApplicationsView
              applications={applications}
              onRefresh={loadData}
            />
          )}
        </main>
      </div>
    </div>
  );
}
export default App;
