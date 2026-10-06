import React from 'react';
import {
  LayoutDashboard,
  FileText,
  Briefcase,
  Target,
  Wand2,
  Mail,
  KanbanSquare,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

export type ActiveTab =
  | 'dashboard'
  | 'resumes'
  | 'jobs'
  | 'match'
  | 'optimizer'
  | 'cover-letters'
  | 'applications';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  resumesCount?: number;
  jobsCount?: number;
  appsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  resumesCount = 0,
  jobsCount = 0,
  appsCount = 0,
}) => {
  const navItems = [
    { id: 'dashboard' as ActiveTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'resumes' as ActiveTab, label: 'Resume Studio', icon: FileText, badge: resumesCount },
    { id: 'jobs' as ActiveTab, label: 'Job Vault', icon: Briefcase, badge: jobsCount },
    { id: 'match' as ActiveTab, label: 'Match Engine', icon: Target, highlight: true },
    { id: 'optimizer' as ActiveTab, label: 'Resume Tailor', icon: Wand2 },
    { id: 'cover-letters' as ActiveTab, label: 'Cover Letters', icon: Mail },
    { id: 'applications' as ActiveTab, label: 'Application CRM', icon: KanbanSquare, badge: appsCount },
  ];

  return (
    <aside className="w-64 shrink-0 border-r border-slate-200/80 bg-white dark:border-slate-800/80 dark:bg-slate-900 hidden md:flex flex-col justify-between py-6 px-4 min-h-[calc(100vh-4rem)]">
      <div className="space-y-6">
        <div>
          <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
            Platform Workflow
          </p>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`group relative flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400 font-semibold shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`h-4 w-4 transition-colors ${
                        isActive
                          ? 'text-brand-600 dark:text-brand-400'
                          : 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>

                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        isActive
                          ? 'bg-brand-200/60 text-brand-700 dark:bg-brand-900 dark:text-brand-200'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}

                  {item.highlight && !isActive && (
                    <span className="flex h-2 w-2 rounded-full bg-brand-500 animate-pulse" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Feature Tip Callout */}
        <div className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50/80 to-sky-50/50 p-4 dark:border-brand-900/40 dark:from-brand-950/40 dark:to-slate-900/60">
          <div className="flex items-center gap-2 text-brand-600 dark:text-brand-400 mb-1.5">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wider">ATS Optimization Tip</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Match score above <strong>75%</strong> boosts interview callbacks by 3.2x. Use the Resume Tailor to address critical missing skills.
          </p>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4 dark:border-slate-800/60 text-[11px] text-slate-400 dark:text-slate-500 flex flex-col gap-1 px-2">
        <p className="font-medium text-slate-600 dark:text-slate-300">ResumeMatch AI v1.0.0</p>
        <p>Production Clean Architecture</p>
      </div>
    </aside>
  );
};
