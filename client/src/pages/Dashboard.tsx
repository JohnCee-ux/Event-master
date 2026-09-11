import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../api/apiClient.js';
import { IEvent, IAttendee, IEventAnalytics } from '../../../shared/types.js';
import {
  CalendarIcon,
  ClockIcon,
  MapPinIcon,
  UsersIcon,
  TicketIcon,
  SearchIcon,
  FilterIcon,
  DownloadIcon,
  MailIcon,
  PlusIcon,
  SparklesIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  RepeatIcon,
  LogOutIcon,
  BarChartIcon,
  ShieldCheckIcon,
  HistoryIcon,
  UndoIcon,
} from '../components/icons/CustomIcons.js';

interface DashboardProps {
  onEnterLiveMode: (eventId: string) => void;
  onViewSummary: (eventId: string) => void;
  onViewAuditLog: (eventId: string) => void;
  onOpenPublicRegister: (eventId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onEnterLiveMode,
  onViewSummary,
  onViewAuditLog,
  onOpenPublicRegister,
}) => {
  const { organizer, logout } = useAuth();

  // Events list & Selected Event
  const [events, setEvents] = useState<IEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [selectedEvent, setSelectedEvent] = useState<IEvent | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(true);

  // Analytics
  const [analytics, setAnalytics] = useState<IEventAnalytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Attendees table state
  const [attendees, setAttendees] = useState<IAttendee[]>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('registeredAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAttendees, setTotalAttendees] = useState(0);

  // Modals & Actions
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '10:00 AM',
    venue: '',
    capacity: 100,
    prefix: 'EVT',
  });
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // View QR Modal
  const [qrModalAttendee, setQrModalAttendee] = useState<IAttendee | null>(null);

  // Notification / Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 1. Fetch Events List
  const fetchEvents = useCallback(async () => {
    try {
      setLoadingEvents(true);
      const res = await api.getEvents();
      setEvents(res.events);

      if (res.events.length > 0) {
        if (!selectedEventId || !res.events.some((e) => e.id === selectedEventId)) {
          setSelectedEventId(res.events[0].id);
        }
      }
    } catch (err: any) {
      console.error('Error fetching events:', err);
    } finally {
      setLoadingEvents(false);
    }
  }, [selectedEventId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // 2. Fetch Selected Event Details & Analytics
  const fetchEventDetails = useCallback(async () => {
    if (!selectedEventId) return;

    try {
      setLoadingAnalytics(true);
      const [evtRes, anaRes] = await Promise.all([
        api.getEvent(selectedEventId),
        api.getEventAnalytics(selectedEventId),
      ]);
      setSelectedEvent(evtRes.event);
      setAnalytics(anaRes.analytics);
    } catch (err: any) {
      console.error('Error loading event analytics:', err);
    } finally {
      setLoadingAnalytics(false);
    }
  }, [selectedEventId]);

  useEffect(() => {
    fetchEventDetails();
  }, [fetchEventDetails]);

  // 3. Fetch Attendees for Table
  const fetchAttendees = useCallback(async () => {
    if (!selectedEventId) return;

    try {
      setLoadingAttendees(true);
      const res = await api.listAttendees(selectedEventId, {
        page,
        limit: 15,
        search: searchQuery,
        filter: statusFilter,
        ticketType: typeFilter,
        sortBy,
        sortOrder,
      });
      setAttendees(res.attendees);
      setTotalPages(res.pagination.totalPages);
      setTotalAttendees(res.pagination.total);
    } catch (err: any) {
      console.error('Error fetching attendees:', err);
    } finally {
      setLoadingAttendees(false);
    }
  }, [selectedEventId, page, searchQuery, statusFilter, typeFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchAttendees();
  }, [fetchAttendees]);

  // Lifecycle actions: Publish, Start, End
  const handlePublish = async () => {
    if (!selectedEventId) return;
    try {
      await api.publishEvent(selectedEventId);
      showToast('Event published successfully! Public registration is now open.');
      fetchEvents();
      fetchEventDetails();
    } catch (err: any) {
      alert(`Publish failed: ${err.message}`);
    }
  };

  const handleStartEvent = async () => {
    if (!selectedEventId) return;
    try {
      await api.startEvent(selectedEventId);
      onEnterLiveMode(selectedEventId);
    } catch (err: any) {
      alert(`Failed to start event: ${err.message}`);
    }
  };

  // Create Event Form Submission
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreatingEvent(true);

    try {
      const res = await api.createEvent({
        ...createForm,
        capacity: Number(createForm.capacity),
      });

      setShowCreateModal(false);
      showToast(`Event "${res.event.name}" created as DRAFT.`);
      setSelectedEventId(res.event.id);
      await fetchEvents();
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create event.');
    } finally {
      setCreatingEvent(false);
    }
  };

  // Check-In / Undo Toggle from Table
  const handleToggleCheckIn = async (attendee: IAttendee) => {
    try {
      if (attendee.checkedInAt) {
        await api.undoCheckIn(attendee.id, 'Organizer dashboard undo');
        showToast(`Check-in reversed for ${attendee.name}.`);
      } else {
        await api.checkInById(attendee.id);
        showToast(`${attendee.name} marked as checked in.`);
      }
      fetchAttendees();
      fetchEventDetails();
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    }
  };

  // Resend Ticket Email
  const handleResendTicket = async (attendee: IAttendee) => {
    try {
      const res = await api.resendTicket(attendee.id);
      showToast(res.message || `Ticket email sent to ${attendee.email}`);
      fetchAttendees();
    } catch (err: any) {
      alert(`Email delivery error: ${err.message}`);
    }
  };

  // CSV Export Download
  const handleExportCSV = () => {
    if (!selectedEventId) return;
    window.open(`/api/events/${selectedEventId}/export/attendees.csv`, '_blank');
  };

  const capacityPct =
    analytics && selectedEvent ? Math.min(100, Math.round((analytics.registeredCount / selectedEvent.capacity) * 100)) : 0;
  const isNearCapacity = capacityPct >= 90;

  return (
    <div className="min-h-screen bg-background text-gray-100 flex flex-col">
      {/* Top Organizer Navigation Bar */}
      <header className="bg-surface border-b border-surface-border px-4 sm:px-6 py-3 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-surface-subtle border border-surface-border text-brand-blue flex items-center justify-center">
              <ShieldCheckIcon size={22} />
            </div>
            <div>
              <div className="font-bold text-white tracking-tight flex items-center gap-2">
                <span>GateKeeper</span>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-brand-blue/15 text-brand-cyan border border-brand-blue/30">
                  Organizer Hub
                </span>
              </div>
              <div className="text-xs text-gray-400">{organizer?.name} &bull; {organizer?.email}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary text-xs py-2 px-3 gap-1.5 font-semibold"
            >
              <PlusIcon size={16} />
              <span>Create Event</span>
            </button>

            <button
              onClick={logout}
              className="btn-secondary text-xs py-2 px-3 gap-1.5 text-gray-400 hover:text-white"
              title="Sign Out"
            >
              <LogOutIcon size={16} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 right-6 z-50 animate-scale-in">
          <div className="panel px-4 py-2.5 bg-surface-subtle border-brand-blue/40 text-xs text-brand-cyan flex items-center gap-2">
            <SparklesIcon size={16} />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Event Selector & Actions Strip */}
        <div className="panel p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 shrink-0">
              Active Event:
            </label>
            <select
              value={selectedEventId}
              onChange={(e) => {
                setSelectedEventId(e.target.value);
                setPage(1);
              }}
              className="input-dark text-sm max-w-md font-medium bg-surface-subtle"
            >
              {events.map((evt) => (
                <option key={evt.id} value={evt.id}>
                  {evt.name} ({evt.status}) - {evt.date}
                </option>
              ))}
            </select>

            {selectedEvent && (
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  selectedEvent.status === 'LIVE'
                    ? 'bg-signal-green/15 text-signal-green border border-signal-green/30 animate-pulse-subtle'
                    : selectedEvent.status === 'UPCOMING'
                    ? 'bg-brand-blue/15 text-brand-cyan border border-brand-blue/30'
                    : selectedEvent.status === 'ENDED'
                    ? 'bg-gray-800 text-gray-400 border border-gray-700'
                    : 'bg-signal-amber/15 text-signal-amber border border-signal-amber/30'
                }`}
              >
                {selectedEvent.status === 'LIVE' && <span className="w-1.5 h-1.5 rounded-full bg-signal-green animate-ping" />}
                {selectedEvent.status}
              </span>
            )}
          </div>

          {/* Quick Lifecycle Action Buttons */}
          {selectedEvent && (
            <div className="flex flex-wrap items-center gap-2">
              {selectedEvent.status === 'DRAFT' && (
                <button onClick={handlePublish} className="btn-amber text-xs py-2 px-3 gap-1.5">
                  <SparklesIcon size={14} />
                  <span>Publish Event</span>
                </button>
              )}

              {selectedEvent.status === 'UPCOMING' && (
                <>
                  <button onClick={handleStartEvent} className="btn-primary text-xs py-2 px-3 gap-1.5 font-bold">
                    <TicketIcon size={14} />
                    <span>Start Check-In (Live Mode)</span>
                  </button>
                  <button
                    onClick={() => onOpenPublicRegister(selectedEvent.id)}
                    className="btn-secondary text-xs py-2 px-3 gap-1.5"
                  >
                    <span>Public Registration Page &rarr;</span>
                  </button>
                </>
              )}

              {selectedEvent.status === 'LIVE' && (
                <>
                  <button
                    onClick={() => onEnterLiveMode(selectedEvent.id)}
                    className="btn-primary bg-signal-green hover:bg-emerald-600 text-xs py-2 px-3.5 gap-1.5 font-bold animate-pulse-subtle"
                  >
                    <TicketIcon size={14} />
                    <span>Open Live Mode Scanner</span>
                  </button>
                  <button
                    onClick={() => onOpenPublicRegister(selectedEvent.id)}
                    className="btn-secondary text-xs py-2 px-3"
                  >
                    Public Page
                  </button>
                </>
              )}

              {selectedEvent.status === 'ENDED' && (
                <button
                  onClick={() => onViewSummary(selectedEvent.id)}
                  className="btn-secondary text-xs py-2 px-3 gap-1.5 text-brand-cyan border-brand-blue/30"
                >
                  <BarChartIcon size={14} />
                  <span>Post-Event Summary</span>
                </button>
              )}

              <button
                onClick={() => onViewAuditLog(selectedEvent.id)}
                className="btn-secondary text-xs py-2 px-3 gap-1.5"
                title="View operational audit log"
              >
                <HistoryIcon size={14} />
                <span>Audit Trail</span>
              </button>
            </div>
          )}
        </div>

        {selectedEvent ? (
          <>
            {/* Bento Statistics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Registered Count */}
              <div className="panel p-5 lg:col-span-2">
                <div className="flex items-center justify-between text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  <span>Registered</span>
                  <UsersIcon size={18} className="text-gray-500" />
                </div>
                <div className="text-4xl font-bold text-white font-mono">
                  {analytics?.registeredCount || 0}
                  <span className="text-sm font-normal text-gray-400 ml-1">/ {selectedEvent.capacity}</span>
                </div>
                <div className="mt-3">
                  <div className="w-full h-1.5 rounded-full bg-surface-subtle overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isNearCapacity ? 'bg-signal-amber' : 'bg-brand-blue'
                      }`}
                      style={{ width: `${capacityPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-gray-400 mt-1">
                    <span>Capacity: {capacityPct}% full</span>
                    <span>{analytics?.remainingCapacity || 0} spots left</span>
                  </div>
                </div>
              </div>

              {/* Checked In Count */}
              <div className="panel p-5">
                <div className="flex items-center justify-between text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  <span>Checked In</span>
                  <CheckCircleIcon size={18} className="text-gray-500" />
                </div>
                <div className="text-3xl font-bold text-signal-green font-mono">
                  {analytics?.checkedInCount || 0}
                </div>
                <div className="text-xs text-gray-400 mt-3 flex items-center gap-1.5">
                  <span className="font-semibold text-white">{analytics?.attendanceRate || 0}%</span>
                  <span>attendance rate</span>
                </div>
              </div>

              {/* Check-In Pace / Recent Rate */}
              <div className="panel p-5">
                <div className="flex items-center justify-between text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  <span>Check-In Pace</span>
                  <ClockIcon size={18} className="text-gray-500" />
                </div>
                <div className="text-3xl font-bold text-white font-mono">
                  {analytics?.recentCheckInRate || 0}
                  <span className="text-xs font-normal text-gray-400 ml-1">scans / 15m</span>
                </div>
                <div className="text-xs text-gray-400 mt-3">
                  Door throughput in the last 15 minutes
                </div>
              </div>

              {/* Event Schedule & Venue */}
              <div className="panel p-5">
                <div className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  Event Venue & Date
                </div>
                <div className="text-sm font-semibold text-white truncate">{selectedEvent.venue}</div>
                <div className="text-xs text-gray-300 mt-1 flex items-center gap-2">
                  <span>{selectedEvent.date}</span>
                  <span>&bull;</span>
                  <span>{selectedEvent.startTime}</span>
                </div>
                <div className="text-[11px] text-brand-cyan font-mono mt-3">
                  Prefix: <span className="font-bold">{selectedEvent.prefix}</span>
                </div>
              </div>
            </div>

            {/* Check-Ins Over Time Responsive Line Chart */}
            {analytics?.checkInsOverTime && analytics.checkInsOverTime.length > 0 && (
              <div className="panel p-5">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="font-semibold text-sm text-white">Check-Ins Over Time</h3>
                    <p className="text-xs text-gray-400">Cumulative and interval entry curve</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1.5 text-brand-cyan">
                      <span className="w-2.5 h-2.5 rounded-full bg-brand-cyan" /> Interval Count
                    </span>
                    <span className="flex items-center gap-1.5 text-brand-blue">
                      <span className="w-2.5 h-2.5 rounded-full bg-brand-blue" /> Cumulative
                    </span>
                  </div>
                </div>

                {/* SVG Visual Chart */}
                <div className="h-44 w-full flex items-end gap-2 pt-4 border-b border-surface-border">
                  {analytics.checkInsOverTime.map((pt, i) => {
                    const maxVal = Math.max(...analytics.checkInsOverTime.map((p) => p.count), 1);
                    const heightPct = Math.max(8, Math.round((pt.count / maxVal) * 100));

                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative">
                        {/* Tooltip on hover */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 bg-surface-subtle border border-surface-border px-2 py-1 rounded text-[10px] text-white whitespace-nowrap z-20 pointer-events-none">
                          {pt.time}: {pt.count} entries (Total: {pt.cumulative})
                        </div>
                        <div
                          className="w-full bg-brand-blue rounded-t transition-all hover:bg-brand-cyan"
                          style={{ height: `${heightPct}%` }}
                        />
                        <span className="text-[10px] text-gray-500 font-mono rotate-45 sm:rotate-0 mt-1">
                          {pt.time}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* First-Class Attendee Table Section */}
            <div className="panel p-5">
              {/* Header with Search, Filters & Export */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-surface-border">
                <div>
                  <h3 className="text-base font-bold text-white">Attendee Directory</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {totalAttendees} registered attendee{totalAttendees === 1 ? '' : 's'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Search Input */}
                  <div className="relative">
                    <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type="text"
                      placeholder="Search name, email, code..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setPage(1);
                      }}
                      className="input-dark pl-9 py-2 text-xs w-48 sm:w-64"
                    />
                  </div>

                  {/* Status Filter */}
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPage(1);
                    }}
                    className="input-dark py-2 text-xs w-36 bg-surface-subtle"
                  >
                    <option value="all">All Status</option>
                    <option value="checked-in">Checked In</option>
                    <option value="not-checked-in">Not Checked In</option>
                    <option value="email-failed">Email Failed</option>
                  </select>

                  {/* Ticket Type Filter */}
                  <select
                    value={typeFilter}
                    onChange={(e) => {
                      setTypeFilter(e.target.value);
                      setPage(1);
                    }}
                    className="input-dark py-2 text-xs w-32 bg-surface-subtle"
                  >
                    <option value="ALL">All Types</option>
                    <option value="General">General</option>
                    <option value="VIP">VIP</option>
                    <option value="Speaker">Speaker</option>
                    <option value="Staff">Staff</option>
                    <option value="Press">Press</option>
                  </select>

                  {/* CSV Export Button */}
                  <button onClick={handleExportCSV} className="btn-secondary py-2 text-xs gap-1.5">
                    <DownloadIcon size={14} />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-surface-border text-gray-400 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="py-3 px-3">Ticket Code</th>
                      <th className="py-3 px-3">Attendee Name</th>
                      <th className="py-3 px-3">Email</th>
                      <th className="py-3 px-3">Ticket Type</th>
                      <th className="py-3 px-3">Check-In Status</th>
                      <th className="py-3 px-3">Check-In Time</th>
                      <th className="py-3 px-3">Email Sent</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border text-gray-300">
                    {loadingAttendees ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-gray-500">
                          <div className="w-6 h-6 border-2 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                          <span>Loading attendees...</span>
                        </td>
                      </tr>
                    ) : attendees.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-gray-500">
                          No attendees found matching your criteria.
                        </td>
                      </tr>
                    ) : (
                      attendees.map((attendee) => (
                        <tr key={attendee.id} className="hover:bg-surface-subtle/50 transition-colors">
                          {/* Ticket Code */}
                          <td className="py-3 px-3 font-mono font-bold text-brand-cyan select-all">
                            {attendee.ticketCode}
                          </td>

                          {/* Name */}
                          <td className="py-3 px-3 font-semibold text-white">
                            {attendee.name}
                          </td>

                          {/* Email */}
                          <td className="py-3 px-3 font-mono text-gray-400">
                            {attendee.email}
                          </td>

                          {/* Ticket Type */}
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded bg-surface-subtle border border-surface-border text-[11px] font-medium text-gray-300">
                              {attendee.ticketType}
                            </span>
                          </td>

                          {/* Check-In Status */}
                          <td className="py-3 px-3">
                            {attendee.checkedInAt ? (
                              <span className="inline-flex items-center gap-1 text-signal-green font-medium">
                                <CheckCircleIcon size={14} /> Checked In
                              </span>
                            ) : (
                              <span className="text-gray-500">Not Checked In</span>
                            )}
                          </td>

                          {/* Check-In Time */}
                          <td className="py-3 px-3 font-mono text-gray-400">
                            {attendee.checkedInAt
                              ? new Date(attendee.checkedInAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '—'}
                          </td>

                          {/* Email Sent */}
                          <td className="py-3 px-3">
                            {attendee.emailSent ? (
                              <span className="text-signal-green">Delivered</span>
                            ) : (
                              <span className="text-signal-amber font-medium">Pending / Failed</span>
                            )}
                          </td>

                          {/* Action Buttons */}
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Check-In / Undo Toggle */}
                              <button
                                onClick={() => handleToggleCheckIn(attendee)}
                                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                                  attendee.checkedInAt
                                    ? 'bg-surface border border-surface-border text-gray-400 hover:text-signal-red hover:border-signal-red/40'
                                    : 'bg-signal-green/15 text-signal-green border border-signal-green/30 hover:bg-signal-green/25'
                                }`}
                                title={attendee.checkedInAt ? 'Undo Check-In' : 'Mark Checked In'}
                              >
                                {attendee.checkedInAt ? 'Undo' : 'Check In'}
                              </button>

                              {/* Resend Email if failed */}
                              {!attendee.emailSent && (
                                <button
                                  onClick={() => handleResendTicket(attendee)}
                                  className="p-1 rounded bg-surface border border-surface-border text-signal-amber hover:text-amber-300"
                                  title="Resend Ticket Email"
                                >
                                  <MailIcon size={14} />
                                </button>
                              )}

                              {/* View QR Code */}
                              <button
                                onClick={() => setQrModalAttendee(attendee)}
                                className="p-1 rounded bg-surface border border-surface-border text-gray-400 hover:text-white"
                                title="View QR Ticket"
                              >
                                <TicketIcon size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
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
          </>
        ) : (
          <div className="panel p-12 text-center">
            <p className="text-gray-400 text-sm">No events found. Click "Create Event" to begin.</p>
          </div>
        )}
      </main>

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
          <div className="panel max-w-lg w-full p-6 sm:p-8 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1">Create New Event</h3>
            <p className="text-xs text-gray-400 mb-5">Events are created in DRAFT status and can be published when ready.</p>

            {createError && (
              <div className="mb-4 p-3 rounded-lg bg-signal-red/10 border border-signal-red/30 text-xs text-signal-red flex items-center gap-2">
                <AlertTriangleIcon size={16} />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateEvent} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-gray-300 uppercase tracking-wider mb-1">Event Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Developer Summit 2026"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="input-dark"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 uppercase tracking-wider mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Event overview, agenda, or door instructions"
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="input-dark"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-300 uppercase tracking-wider mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={createForm.date}
                    onChange={(e) => setCreateForm({ ...createForm, date: e.target.value })}
                    className="input-dark"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 uppercase tracking-wider mb-1">Start Time</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 10:00 AM"
                    value={createForm.startTime}
                    onChange={(e) => setCreateForm({ ...createForm, startTime: e.target.value })}
                    className="input-dark"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-300 uppercase tracking-wider mb-1">Venue / Location</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Convention Center Hall A"
                    value={createForm.venue}
                    onChange={(e) => setCreateForm({ ...createForm, venue: e.target.value })}
                    className="input-dark"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 uppercase tracking-wider mb-1">Capacity</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={createForm.capacity}
                    onChange={(e) => setCreateForm({ ...createForm, capacity: Number(e.target.value) })}
                    className="input-dark"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 uppercase tracking-wider mb-1">
                  Ticket Prefix (2-6 letters)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  placeholder="e.g. DEV"
                  value={createForm.prefix}
                  onChange={(e) => setCreateForm({ ...createForm, prefix: e.target.value.toUpperCase() })}
                  className="input-dark font-mono uppercase"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={creatingEvent}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingEvent}
                  className="btn-primary text-xs font-semibold"
                >
                  {creatingEvent ? 'Creating...' : 'Create Draft Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Ticket Inspector Modal */}
      {qrModalAttendee && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
          <div className="panel max-w-sm w-full p-6 text-center shadow-2xl">
            <h4 className="font-bold text-white text-base mb-1">{qrModalAttendee.name}</h4>
            <div className="inline-block px-2.5 py-0.5 rounded-full bg-brand-blue/15 text-brand-cyan text-xs font-mono font-bold mb-4">
              {qrModalAttendee.ticketCode}
            </div>

            <div className="bg-white p-4 rounded-xl inline-block mx-auto mb-4">
              {/* Fallback QR via online service or DataUrl */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                  qrModalAttendee.qrToken
                )}`}
                alt="QR Code"
                className="w-44 h-44 block mx-auto"
              />
            </div>

            <div className="text-xs text-gray-400 space-y-1 mb-5">
              <div>Type: <span className="text-white font-medium">{qrModalAttendee.ticketType}</span></div>
              <div>Email: <span className="text-gray-300 font-mono">{qrModalAttendee.email}</span></div>
            </div>

            <button
              onClick={() => setQrModalAttendee(null)}
              className="w-full btn-secondary text-xs py-2"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
