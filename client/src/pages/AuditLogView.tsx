import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import { api } from '../api/apiClient.js';
import { IAuditLog } from '../../../shared/types.js';

interface AuditLogViewProps {
  eventId: string;
  onBack: () => void;
}

const btnSoft =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-[#f0f3f2] px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-[#e6ebe9] disabled:opacity-40';

// Plain-language label + soft pill colour for each action. Unknown actions fall back to the raw name.
const actionMeta: Record<string, { label: string; cls: string }> = {
  CHECK_IN: { label: 'Checked in', cls: 'bg-emerald-100 text-emerald-800' },
  DUPLICATE_CHECK_IN: { label: 'Duplicate scan', cls: 'bg-amber-100 text-amber-800' },
  INVALID_CHECK_IN: { label: 'Invalid ticket', cls: 'bg-red-100 text-red-800' },
  UNDO_CHECK_IN: { label: 'Check-in undone', cls: 'bg-[#dcd7fb] text-stone-800' },
  OFFLINE_SCAN_SYNCED: { label: 'Offline scan synced', cls: 'bg-sky-100 text-sky-800' },
  OFFLINE_SCAN_REJECTED: { label: 'Offline scan rejected', cls: 'bg-red-100 text-red-800' },
  REGISTER_ATTENDEE: { label: 'Registered', cls: 'bg-[#eefbc4] text-stone-800' },
  START_EVENT: { label: 'Event started', cls: 'bg-stone-100 text-stone-700' },
  END_EVENT: { label: 'Event ended', cls: 'bg-stone-100 text-stone-700' },
  CREATE_EVENT: { label: 'Event created', cls: 'bg-stone-100 text-stone-700' },
  PUBLISH_EVENT: { label: 'Event published', cls: 'bg-stone-100 text-stone-700' },
};

const filterOptions: { value: string; label: string }[] = [
  { value: 'ALL', label: 'All actions' },
  { value: 'CHECK_IN', label: 'Checked in' },
  { value: 'DUPLICATE_CHECK_IN', label: 'Duplicate scans' },
  { value: 'INVALID_CHECK_IN', label: 'Invalid tickets' },
  { value: 'UNDO_CHECK_IN', label: 'Check-ins undone' },
  { value: 'REGISTER_ATTENDEE', label: 'Registrations' },
  { value: 'OFFLINE_SCAN_SYNCED', label: 'Offline scans synced' },
  { value: 'OFFLINE_SCAN_REJECTED', label: 'Offline scans rejected' },
  { value: 'START_EVENT', label: 'Event started' },
  { value: 'END_EVENT', label: 'Event ended' },
  { value: 'CREATE_EVENT', label: 'Event created' },
  { value: 'PUBLISH_EVENT', label: 'Event published' },
];

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

  const getActionPill = (action: string) => {
    const meta = actionMeta[action];
    return (
      <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${meta ? meta.cls : 'bg-stone-100 text-stone-600'}`}>
        {meta ? meta.label : action}
      </span>
    );
  };

  const hasMetadata = (log: IAuditLog) => !!log.metadata && Object.keys(log.metadata).length > 0;

  return (
    <div className="min-h-screen bg-[#e4e8e7] p-0 text-stone-900 sm:p-6">
      <div className="mx-auto min-h-screen max-w-5xl bg-[#f1f5f4] px-4 py-6 sm:min-h-[calc(100vh-3rem)] sm:rounded-[28px] sm:px-8 sm:py-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <button onClick={onBack} className="mb-3 inline-flex items-center gap-2 text-sm text-stone-600 hover:text-stone-900">
              <ArrowLeft size={15} /> Back to dashboard
            </button>
            <h1 className="text-2xl font-bold tracking-tight">Audit log</h1>
            <p className="mt-0.5 text-sm text-stone-500">
              {totalLogs} recorded {totalLogs === 1 ? 'action' : 'actions'} on this event. Entries can't be edited or deleted.
            </p>
          </div>

          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by action"
            className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-900 focus:border-stone-400 focus:outline-none sm:w-56"
          >
            {filterOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="mt-6 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(20,30,25,0.04)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-xs text-stone-400">
                  <th className="py-3 pr-4 font-medium">When</th>
                  <th className="py-3 pr-4 font-medium">Action</th>
                  <th className="py-3 pr-4 font-medium">Guest</th>
                  <th className="hidden py-3 pr-4 font-medium sm:table-cell">Ticket</th>
                  <th className="hidden py-3 font-medium md:table-cell">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-14 text-center text-stone-400">Loading…</td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-14 text-center">
                      <p className="font-medium text-stone-700">
                        {actionFilter === 'ALL' ? 'Nothing has been recorded yet.' : 'No entries for this filter.'}
                      </p>
                      {actionFilter !== 'ALL' && (
                        <button onClick={() => { setActionFilter('ALL'); setPage(1); }} className={`${btnSoft} mt-3`}>
                          Show all actions
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#f7faf9]">
                      <td className="whitespace-nowrap py-3 pr-4 text-stone-500">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3 pr-4">{getActionPill(log.action)}</td>
                      <td className="py-3 pr-4 font-medium">{log.attendeeName || '—'}</td>
                      <td className="hidden py-3 pr-4 font-mono text-xs text-stone-500 sm:table-cell">
                        {log.ticketCode || '—'}
                      </td>
                      <td
                        className="hidden max-w-xs truncate py-3 font-mono text-xs text-stone-400 md:table-cell"
                        title={hasMetadata(log) ? JSON.stringify(log.metadata) : undefined}
                      >
                        {hasMetadata(log) ? JSON.stringify(log.metadata) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-4 text-sm text-stone-500">
              <span>Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className={btnSoft}>
                  Previous
                </button>
                <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className={btnSoft}>
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