import React, { useState } from 'react';
import {
  KanbanSquare,
  Plus,
  Building,
  MapPin,
  DollarSign,
  Clock,
  CheckCircle2,
  Calendar,
  List,
  Columns,
  MessageSquare,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { Application, ApplicationStatus } from '@shared';
import { api } from '../api';

interface ApplicationsViewProps {
  applications: Application[];
  onRefresh: () => Promise<void>;
  onCreateNew?: () => void;
}

export const ApplicationsView: React.FC<ApplicationsViewProps> = ({
  applications,
  onRefresh,
}) => {
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New application form state
  const [company, setCompany] = useState('');
  const [position, setPosition] = useState('');
  const [location, setLocation] = useState('Remote');
  const [salary, setSalary] = useState('');
  const [status, setStatus] = useState<ApplicationStatus>('saved');
  const [matchScore, setMatchScore] = useState<number>(85);
  const [notes, setNotes] = useState('');
  const [selectedTimelineApp, setSelectedTimelineApp] = useState<Application | null>(null);

  const stages: { id: ApplicationStatus; label: string; color: string }[] = [
    { id: 'saved', label: 'Saved', color: 'border-slate-300 dark:border-slate-700' },
    { id: 'applied', label: 'Applied', color: 'border-blue-400 dark:border-blue-700' },
    { id: 'screening', label: 'Screening', color: 'border-amber-400 dark:border-amber-700' },
    { id: 'interviewing', label: 'Interviewing', color: 'border-indigo-400 dark:border-indigo-700' },
    { id: 'offer', label: 'Offer', color: 'border-emerald-400 dark:border-emerald-700' },
    { id: 'rejected', label: 'Archived / Rejected', color: 'border-rose-300 dark:border-rose-800' },
  ];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !position) return;

    try {
      setIsSubmitting(true);
      await api.createApplication({
        company,
        position,
        location,
        salary,
        status,
        matchScore: Number(matchScore) || undefined,
        notes,
      });
      await onRefresh();
      setCreateModalOpen(false);
      setCompany('');
      setPosition('');
      setNotes('');
    } catch (err: any) {
      alert(err.message || 'Failed to create application');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: ApplicationStatus) => {
    try {
      await api.updateApplicationStatus(id, newStatus);
      await onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Application CRM Pipeline
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Track interview progression, salary negotiations, and timeline milestones.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
            <button
              onClick={() => setViewMode('kanban')}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold flex items-center gap-1 transition-colors ${
                viewMode === 'kanban'
                  ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Columns className="h-3.5 w-3.5" />
              <span>Board</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold flex items-center gap-1 transition-colors ${
                viewMode === 'table'
                  ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              <span>Table</span>
            </button>
          </div>

          <button
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-md shadow-brand-500/20 hover:bg-brand-600 active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Track Application</span>
          </button>
        </div>
      </div>

      {/* Kanban Board View */}
      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => {
            const stageApps = applications.filter((a) => a.status === stage.id);
            return (
              <div
                key={stage.id}
                className="flex flex-col rounded-2xl bg-slate-100/60 p-3 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 min-h-[500px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 px-1 border-b border-slate-200 dark:border-slate-800 mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full border-2 ${stage.color} bg-current`} />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      {stage.label}
                    </h3>
                  </div>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300 shadow-2xs">
                    {stageApps.length}
                  </span>
                </div>

                {/* Cards List */}
                <div className="space-y-2.5 flex-1">
                  {stageApps.map((app) => (
                    <div
                      key={app.id}
                      className="group rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-850 hover:shadow-md transition-all space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <h4 className="font-bold text-xs text-slate-900 dark:text-white leading-tight">
                            {app.position}
                          </h4>
                          <p className="text-xs text-brand-600 dark:text-brand-400 font-medium">
                            {app.company}
                          </p>
                        </div>

                        {app.matchScore && (
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            app.matchScore >= 80 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {app.matchScore}%
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-400 space-y-0.5">
                        <p className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span>{app.location}</span>
                        </p>
                        {app.salary && (
                          <p className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                            <DollarSign className="h-3 w-3" />
                            <span>{app.salary}</span>
                          </p>
                        )}
                      </div>

                      {app.notes && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 italic bg-slate-50 dark:bg-slate-900/50 p-1.5 rounded-lg border border-slate-100 dark:border-slate-800">
                          "{app.notes}"
                        </p>
                      )}

                      {/* Card Footer: Status Shift + Timeline */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px]">
                        <button
                          onClick={() => setSelectedTimelineApp(app)}
                          className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1"
                        >
                          <Clock className="h-3 w-3" />
                          <span>{app.timeline.length} events</span>
                        </button>

                        <select
                          value={app.status}
                          onChange={(e) => handleStatusChange(app.id, e.target.value as ApplicationStatus)}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        >
                          <option value="saved">Saved</option>
                          <option value="applied">Applied</option>
                          <option value="screening">Screening</option>
                          <option value="interviewing">Interview</option>
                          <option value="offer">Offer</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </div>
                    </div>
                  ))}

                  {stageApps.length === 0 && (
                    <div className="h-24 flex items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-[11px] text-slate-400">
                      Empty
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50/75 dark:border-slate-800 dark:bg-slate-800/50 font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3">Role & Company</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Match Score</th>
                <th className="px-6 py-3">Location & Comp</th>
                <th className="px-6 py-3">Applied Date</th>
                <th className="px-6 py-3">Timeline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {applications.map((app) => (
                <tr key={app.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-900 dark:text-white">{app.position}</p>
                    <p className="text-brand-600 dark:text-brand-400">{app.company}</p>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={app.status}
                      onChange={(e) => handleStatusChange(app.id, e.target.value as ApplicationStatus)}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                    >
                      <option value="saved">Saved</option>
                      <option value="applied">Applied</option>
                      <option value="screening">Screening</option>
                      <option value="interviewing">Interviewing</option>
                      <option value="offer">Offer</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {app.matchScore ? `${app.matchScore}%` : '—'}
                  </td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                    <p>{app.location}</p>
                    {app.salary && <p className="font-medium text-emerald-600">{app.salary}</p>}
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {app.appliedDate || 'Not applied yet'}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setSelectedTimelineApp(app)}
                      className="text-brand-600 hover:underline flex items-center gap-1"
                    >
                      <span>{app.timeline.length} updates</span>
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Timeline Modal */}
      {selectedTimelineApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-scaleUp">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Application Milestones
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              {selectedTimelineApp.position} at {selectedTimelineApp.company}
            </p>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {selectedTimelineApp.timeline.map((evt, idx) => (
                <div key={idx} className="relative pl-6 border-l-2 border-brand-500 space-y-1">
                  <div className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-brand-500 ring-4 ring-white dark:ring-slate-900" />
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                      {evt.stage}
                    </span>
                    <span className="text-[10px] text-slate-400">{evt.date}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{evt.note}</p>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setSelectedTimelineApp(null)}
                className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Application Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-scaleUp">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
              Track New Job Application
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Add a position to your CRM board to monitor stages and interview schedules.
            </p>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Company *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Stripe, Figma, Datadog"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Position *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Senior Software Engineer"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Salary / Compensation
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. $180,000"
                    value={salary}
                    onChange={(e) => setSalary(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Current Stage
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ApplicationStatus)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="saved">Saved</option>
                    <option value="applied">Applied</option>
                    <option value="screening">Screening</option>
                    <option value="interviewing">Interviewing</option>
                    <option value="offer">Offer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Match Score %
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={matchScore}
                    onChange={(e) => setMatchScore(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Notes / Interview Intel
                </label>
                <textarea
                  rows={3}
                  placeholder="Referral contact, key topics discussed, next interview dates..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                  disabled={isSubmitting || !company || !position}
                  className="rounded-xl bg-brand-500 px-5 py-2 text-xs font-semibold text-white shadow-md shadow-brand-500/20 hover:bg-brand-600 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Add to Pipeline'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
