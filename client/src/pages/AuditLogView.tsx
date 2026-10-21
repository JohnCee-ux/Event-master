import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api/apiClient.js';
import { IAuditLog } from '../../../shared/types.js';
import {
  ArrowLeftIcon,
  FilterIcon,
  ShieldCheckIcon,
  ClockIcon,
  CheckCircleIcon,
  RepeatIcon,
  XCircleIcon,
  UndoIcon,
  CloudSyncIcon,
} from '../components/icons/CustomIcons.js';

interface AuditLogViewProps {
  eventId: string;
  onBack: () => void;
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ eventId, onBack }) => {
  const [logs, setLogs] = useState<IAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getAuditLogs(eventId, {
        page,
        limit: 25,
        action: actionFilter,
      });
      setLogs(res.logs);
      setTotalPages(res.pagination.totalPages);
      setTotalLogs(res.pagination.total);
    } catch (err) {
      console.error('Failed to fetch audit log:', err);
    } finally {
      setLoading(false);
    }
  }, [eventId, page, actionFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CHECK_IN':
        return <span className="px-2 py-0.5 rounded bg-signal-green/15 text-signal-green border border-signal-green/30 font-semibold text-[10px]">CHECK_IN</span>;
      case 'DUPLICATE_CHECK_IN':
        return <span className="px-2 py-0.5 rounded bg-signal-amber/15 text-signal-amber border border-signal-amber/30 font-semibold text-[10px]">DUPLICATE_SCAN</span>;
      case 'INVALID_CHECK_IN':
        return <span className="px-2 py-0.5 rounded bg-signal-red/15 text-signal-red border border-signal-red/30 font-semibold text-[10px]">INVALID_ATTEMPT</span>;
      case 'UNDO_CHECK_IN':
        return <span className="px-2 py-0.5 rounded bg-brand-purple/20 text-brand-purple border border-brand-purple/40 font-semibold text-[10px]">UNDO_CHECK_IN</span>;
      case 'OFFLINE_SCAN_SYNCED':
        return <span className="px-2 py-0.5 rounded bg-brand-blue/20 text-brand-cyan border border-brand-blue/30 font-semibold text-[10px]">OFFLINE_SYNC</span>;
      case 'REGISTER_ATTENDEE':
        return <span className="px-2 py-0.5 rounded bg-brand-pink/20 text-brand-pink border border-brand-pink/30 font-semibold text-[10px]">REGISTER</span>;
      default:
        return <span className="px-2 py-0.5 rounded bg-surface-subtle text-gray-300 border border-surface-border text-[10px] font-mono">{action}</span>;
    }
  };

  return (
    <div className="page-shell text-gray-100 p-4 sm:p-8 flex flex-col items-center">
      <div className="max-w-5xl w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-surface-border">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-lg bg-surface-subtle border border-surface-border text-gray-300 hover:text-white transition-colors"
            >
              <ArrowLeftIcon size={18} />
            </button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <span>Operational Audit Trail</span>
                <span className="text-xs px-2 py-0.5 rounded bg-surface-subtle border border-surface-border text-gray-400 font-mono">
                  Append-Only
                </span>
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">
                Immutable security & event history ({totalLogs} recorded events)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="input-dark py-2 text-xs w-48 bg-surface-subtle"
            >
              <option value="ALL">All Actions</option>
              <option value="CHECK_IN">CHECK_IN</option>
              <option value="DUPLICATE_CHECK_IN">DUPLICATE_CHECK_IN</option>
              <option value="INVALID_CHECK_IN">INVALID_CHECK_IN</option>
              <option value="UNDO_CHECK_IN">UNDO_CHECK_IN</option>
              <option value="REGISTER_ATTENDEE">REGISTER_ATTENDEE</option>
              <option value="OFFLINE_SCAN_SYNCED">OFFLINE_SCAN_SYNCED</option>
              <option value="OFFLINE_SCAN_REJECTED">OFFLINE_SCAN_REJECTED</option>
              <option value="START_EVENT">START_EVENT</option>
              <option value="END_EVENT">END_EVENT</option>
              <option value="CREATE_EVENT">CREATE_EVENT</option>
              <option value="PUBLISH_EVENT">PUBLISH_EVENT</option>
            </select>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="panel p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-surface-border text-gray-400 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Attendee / Target</th>
                  <th className="py-2.5 px-3">Ticket Code</th>
                  <th className="py-2.5 px-3">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border text-gray-300">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-500">
                      <div className="w-6 h-6 border-2 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      <span>Loading audit entries...</span>
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-500">
                      No audit events recorded for this filter.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-surface-subtle/50 transition-colors">
                      <td className="py-3 px-3 font-mono text-gray-400 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3 px-3">{getActionBadge(log.action)}</td>
                      <td className="py-3 px-3 font-medium text-white">
                        {log.attendeeName || '—'}
                      </td>
                      <td className="py-3 px-3 font-mono text-brand-cyan">
                        {log.ticketCode || '—'}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-gray-400 max-w-xs truncate">
                        {JSON.stringify(log.metadata || {})}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 mt-2 border-t border-surface-border text-xs text-gray-400">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-1.5">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="btn-secondary py-1 px-3 text-xs disabled:opacity-30"
                >
                  Previous
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="btn-secondary py-1 px-3 text-xs disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
