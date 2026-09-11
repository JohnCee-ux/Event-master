import React, { useState, useEffect } from 'react';
import { api } from '../api/apiClient.js';
import { IPostEventSummary } from '../../../shared/types.js';
import {
  ArrowLeftIcon,
  BarChartIcon,
  CheckCircleIcon,
  ClockIcon,
  DownloadIcon,
  RepeatIcon,
  UsersIcon,
  XCircleIcon,
  CloudSyncIcon,
  MailIcon,
  ShieldCheckIcon,
} from '../components/icons/CustomIcons.js';

interface PostEventSummaryProps {
  eventId: string;
  onBack: () => void;
}

export const PostEventSummary: React.FC<PostEventSummaryProps> = ({ eventId, onBack }) => {
  const [summary, setSummary] = useState<IPostEventSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        setLoading(true);
        const res = await api.getPostEventSummary(eventId);
        setSummary(res.summary);
      } catch (err: any) {
        setError(err.message || 'Failed to load post-event summary.');
      } finally {
        setLoading(false);
      }
    };
    if (eventId) {
      fetchSummary();
    }
  }, [eventId]);

  const handleExportCSV = () => {
    window.open(`/api/events/${eventId}/export/attendees.csv`, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-400">Compiling post-event analytics...</span>
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="panel max-w-md w-full p-8 text-center">
          <h2 className="text-lg font-bold text-white mb-2">Summary Unavailable</h2>
          <p className="text-sm text-gray-400 mb-6">{error || 'Could not load summary.'}</p>
          <button onClick={onBack} className="btn-secondary text-xs">
            &larr; Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-gray-100 p-4 sm:p-8 flex flex-col items-center">
      <div className="max-w-5xl w-full space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-surface-border">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-lg bg-surface-subtle border border-surface-border text-gray-300 hover:text-white transition-colors"
            >
              <ArrowLeftIcon size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Post-Event Summary</h1>
                <span className="px-2.5 py-0.5 rounded-full bg-gray-800 text-gray-400 text-xs font-semibold uppercase tracking-wider border border-gray-700">
                  ENDED
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {summary.eventName} &bull; {summary.venue} &bull; {summary.date}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={handleExportCSV} className="btn-primary text-xs py-2 px-3 gap-1.5 font-semibold">
              <DownloadIcon size={14} />
              <span>Export Final Attendees CSV</span>
            </button>
          </div>
        </div>

        {/* Key Highlights Bento Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Registered */}
          <div className="panel p-5 lg:col-span-2">
            <div className="text-xs uppercase font-semibold tracking-wider text-gray-400 mb-1 flex items-center justify-between">
              <span>Total Registered</span>
              <UsersIcon size={16} className="text-gray-500" />
            </div>
            <div className="text-4xl font-bold text-white font-mono">{summary.registeredCount}</div>
            <div className="text-xs text-gray-400 mt-2">100% capacity baseline</div>
          </div>

          {/* Checked In */}
          <div className="panel p-5">
            <div className="text-xs uppercase font-semibold tracking-wider text-gray-400 mb-1 flex items-center justify-between">
              <span>Total Checked In</span>
              <CheckCircleIcon size={16} className="text-gray-500" />
            </div>
            <div className="text-3xl font-bold text-signal-green font-mono">{summary.checkedInCount}</div>
            <div className="text-xs text-gray-400 mt-2">{summary.attendanceRate}% final attendance rate</div>
          </div>

          {/* Peak Check-In Time */}
          <div className="panel p-5">
            <div className="text-xs uppercase font-semibold tracking-wider text-gray-400 mb-1 flex items-center justify-between">
              <span>Peak Check-In</span>
              <ClockIcon size={16} className="text-gray-500" />
            </div>
            <div className="text-xl font-bold text-white font-mono truncate">
              {summary.peakCheckInPeriod || 'N/A'}
            </div>
            <div className="text-xs text-gray-400 mt-2">Highest throughput window</div>
          </div>

          {/* No-Shows */}
          <div className="panel p-5">
            <div className="text-xs uppercase font-semibold tracking-wider text-gray-400 mb-1 flex items-center justify-between">
              <span>No-Shows</span>
              <XCircleIcon size={16} className="text-gray-500" />
            </div>
            <div className="text-3xl font-bold text-gray-300 font-mono">{summary.noShowCount}</div>
            <div className="text-xs text-gray-400 mt-2">
              {summary.registeredCount > 0
                ? ((summary.noShowCount / summary.registeredCount) * 100).toFixed(1)
                : 0}
              % absent
            </div>
          </div>
        </div>

        {/* Operating Timestamps & Ticket Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Operations Timeline Card */}
          <div className="panel p-5 space-y-3.5">
            <h3 className="font-bold text-sm text-white border-b border-surface-border pb-2.5">
              Door Operations Timeline
            </h3>
            <div className="flex justify-between text-xs py-1 border-b border-surface-border/50">
              <span className="text-gray-400">First Door Check-In:</span>
              <span className="font-mono text-white font-semibold">
                {summary.firstCheckInAt ? new Date(summary.firstCheckInAt).toLocaleTimeString() : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between text-xs py-1 border-b border-surface-border/50">
              <span className="text-gray-400">Peak Entry Period:</span>
              <span className="font-mono text-brand-cyan font-semibold">{summary.peakCheckInPeriod || 'N/A'}</span>
            </div>
            <div className="flex justify-between text-xs py-1 border-b border-surface-border/50">
              <span className="text-gray-400">Last Door Check-In:</span>
              <span className="font-mono text-white font-semibold">
                {summary.lastCheckInAt ? new Date(summary.lastCheckInAt).toLocaleTimeString() : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between text-xs py-1">
              <span className="text-gray-400">Event Ended At:</span>
              <span className="font-mono text-gray-300">
                {summary.endedAt ? new Date(summary.endedAt).toLocaleTimeString() : 'N/A'}
              </span>
            </div>
          </div>

          {/* Ticket Breakdown Card */}
          <div className="panel p-5 space-y-3">
            <h3 className="font-bold text-sm text-white border-b border-surface-border pb-2.5">
              Breakdown by Pass / Ticket Type
            </h3>
            <div className="space-y-2">
              {Object.entries(summary.ticketTypeBreakdown || {}).map(([type, stats]) => {
                const rate = stats.registered > 0 ? Math.round((stats.checkedIn / stats.registered) * 100) : 0;
                return (
                  <div key={type} className="panel-subtle p-3 text-xs flex justify-between items-center">
                    <div>
                      <span className="font-semibold text-white">{type}</span>
                      <div className="text-[11px] text-gray-400">
                        {stats.checkedIn} / {stats.registered} arrived
                      </div>
                    </div>
                    <div className="text-right font-mono font-bold text-brand-cyan">{rate}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Operational Integrity & Audit Log Metrics */}
        <div className="panel p-5">
          <h3 className="font-bold text-sm text-white border-b border-surface-border pb-2.5 mb-4">
            Operational Security & System Metrics
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div className="panel-subtle p-3">
              <div className="text-[11px] uppercase tracking-wider text-gray-400 mb-1">Duplicate Scans Blocked</div>
              <div className="text-2xl font-bold text-signal-amber font-mono">{summary.duplicateScanCount}</div>
            </div>
            <div className="panel-subtle p-3">
              <div className="text-[11px] uppercase tracking-wider text-gray-400 mb-1">Invalid Scans Rejected</div>
              <div className="text-2xl font-bold text-signal-red font-mono">{summary.invalidScanCount}</div>
            </div>
            <div className="panel-subtle p-3">
              <div className="text-[11px] uppercase tracking-wider text-gray-400 mb-1">Offline Scans Synced</div>
              <div className="text-2xl font-bold text-brand-cyan font-mono">{summary.offlineScansSynced}</div>
            </div>
            <div className="panel-subtle p-3">
              <div className="text-[11px] uppercase tracking-wider text-gray-400 mb-1">Email Delivery Failures</div>
              <div className="text-2xl font-bold text-gray-300 font-mono">{summary.emailFailureCount}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
