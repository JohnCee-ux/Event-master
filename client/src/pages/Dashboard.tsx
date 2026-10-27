import React, { useState, useEffect, useCallback, useRef } from 'react';
import QRCode from 'qrcode';
import {
  ChevronRight, ClipboardList, Copy, Download, LayoutDashboard, LogOut, Mail,
  Plus, QrCode, Search, ShieldCheck, Trash2, Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../api/apiClient.js';
import { IEvent, IAttendee, IEventAnalytics } from '../../../shared/types.js';
import { BrandLogo } from '../components/BrandLogo.js';

interface DashboardProps {
  onEnterLiveMode: (eventId: string) => void;
  onViewSummary: (eventId: string) => void;
  onViewAuditLog: (eventId: string) => void;
  onOpenPublicRegister: (eventId: string) => void;
  onNavigateToSuperAdmin?: () => void;
}

/*
  Standard Tailwind + a few arbitrary colours, so no config or custom CSS needed.
  Palette: tinted page, white panels, pastel stat cards, one lime accent, one teal feature card.
*/
const BRAND_ACCENT = 'brand-gradient text-white hover:brightness-110';
const field =
  'w-full rounded-xl border border-stone-200 bg-[#f4f7f6] px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-400 focus:bg-white focus:outline-none';
const btnBrand = `inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${BRAND_ACCENT}`;
const btnDark =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-700 disabled:opacity-50';
const btnSoft =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-[#f0f3f2] px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-[#e6ebe9] disabled:opacity-50';
const panel = 'rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(20,30,25,0.04)]';

const statusMeta: Record<string, { label: string; dot: string }> = {
  LIVE: { label: 'Live now', dot: 'bg-emerald-500' },
  UPCOMING: { label: 'Upcoming', dot: 'bg-sky-500' },
  ENDED: { label: 'Ended', dot: 'bg-stone-400' },
  DRAFT: { label: 'Draft', dot: 'bg-amber-500' },
};

const initialsOf = (name?: string) => {
  if (!name) return 'GK';
  const p = name.trim().split(' ');
  return (p.length >= 2 ? `${p[0][0]}${p[1][0]}` : name.slice(0, 2)).toUpperCase();
};

export const Dashboard: React.FC<DashboardProps> = ({
  onEnterLiveMode, onViewAuditLog, onNavigateToSuperAdmin,
}) => {
  const { organizer, logout } = useAuth();

  const [events, setEvents] = useState<IEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [selectedEvent, setSelectedEvent] = useState<IEvent | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [analytics, setAnalytics] = useState<IEventAnalytics | null>(null);

  const [attendees, setAttendees] = useState<IAttendee[]>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);
  const [attendeeListError, setAttendeeListError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAttendees, setTotalAttendees] = useState(0);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '', description: '',
    imageDataUrl: null as string | null,
    date: new Date().toISOString().split('T')[0],
    startTime: '10:00 AM', venue: '', capacity: 100, prefix: 'EVT',
  });
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [qrModalAttendee, setQrModalAttendee] = useState<IAttendee | null>(null);
  const [qrModalUrl, setQrModalUrl] = useState<string | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [selectedAttendeeIds, setSelectedAttendeeIds] = useState<string[]>([]);
  const [resendingAttendeeId, setResendingAttendeeId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string, error = false) => {
    setToast({ msg, error });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (event.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
      if (event.key === 'Escape') {
        setShowCreateModal(false);
        setQrModalAttendee(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (qrModalAttendee) {
      QRCode.toDataURL(qrModalAttendee.qrToken || qrModalAttendee.ticketCode, {
        width: 320, margin: 2, color: { dark: '#1c1917', light: '#FFFFFF' },
      }).then(setQrModalUrl).catch(() => setQrModalUrl(null));
    } else {
      setQrModalUrl(null);
    }
  }, [qrModalAttendee]);

  const fetchEvents = useCallback(async () => {
    try {
      setLoadingEvents(true);
      const res = await api.getEvents();
      setEvents(res.events);
      if (res.events.length > 0 && (!selectedEventId || !res.events.some(e => e.id === selectedEventId))) {
        setSelectedEventId(res.events[0].id);
      }
    } catch (err) { console.error(err); }
    finally { setLoadingEvents(false); }
  }, [selectedEventId]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  useEffect(() => {
    setPage(1);
    setSelectedAttendeeIds([]);
  }, [selectedEventId]);

  const fetchEventDetails = useCallback(async () => {
    if (!selectedEventId) return;
    try {
      const [evtRes, anaRes] = await Promise.all([api.getEvent(selectedEventId), api.getEventAnalytics(selectedEventId)]);
      setSelectedEvent(evtRes.event); setAnalytics(anaRes.analytics);
    } catch (err) { console.error(err); }
  }, [selectedEventId]);

  useEffect(() => { fetchEventDetails(); }, [fetchEventDetails]);

  const fetchAttendees = useCallback(async () => {
    if (!selectedEventId) return;
    try {
      setLoadingAttendees(true);
      setAttendeeListError(null);
      const res = await api.listAttendees(selectedEventId, {
        page, limit: 15, search: searchQuery, filter: statusFilter, ticketType: typeFilter,
        sortBy: 'registeredAt', sortOrder: 'desc',
      });
      setAttendees(res.attendees); setTotalPages(res.pagination.totalPages); setTotalAttendees(res.pagination.total);
    } catch (err: any) {
      console.error(err);
      setAttendees([]);
      setTotalPages(1);
      setTotalAttendees(0);
      setAttendeeListError(err.message || 'Could not load the guest list.');
    }
    finally { setLoadingAttendees(false); }
  }, [selectedEventId, page, searchQuery, statusFilter, typeFilter]);

  useEffect(() => { fetchAttendees(); }, [fetchAttendees]);

  const handlePublish = async () => {
    if (!selectedEventId) return;
    try {
      await api.publishEvent(selectedEventId);
      showToast('Published. People can register now.');
      fetchEvents(); fetchEventDetails();
    } catch (err: any) { showToast(`Couldn't publish: ${err.message}`, true); }
  };

  const handleStartEvent = async () => {
    if (!selectedEventId) return;
    try {
      await api.startEvent(selectedEventId);
      onEnterLiveMode(selectedEventId);
    } catch (err: any) { showToast(`Couldn't start the event: ${err.message}`, true); }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null); setCreatingEvent(true);
    try {
      const res = await api.createEvent({ ...createForm, capacity: Number(createForm.capacity) });
      setShowCreateModal(false);
      showToast(`"${res.event.name}" saved as a draft.`);
      setSelectedEventId(res.event.id);
      await fetchEvents();
    } catch (err: any) { setCreateError(err.message || 'Could not create the event.'); }
    finally { setCreatingEvent(false); }
  };

  const handleEventImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setCreateError('Please choose an image file (PNG, JPG, WEBP or GIF).');
      e.target.value = '';
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setCreateError('The image must be 2 MB or smaller.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        setCreateForm((c) => ({ ...c, imageDataUrl: result }));
        setCreateError(null);
      }
    };
    reader.onerror = () => setCreateError('Could not read that image. Try again.');
    reader.readAsDataURL(file);
  };

  const handleToggleCheckIn = async (attendee: IAttendee) => {
    try {
      if (attendee.checkedInAt) {
        await api.undoCheckIn(attendee.id, 'Organizer dashboard undo');
        showToast(`Check-in undone for ${attendee.name}.`);
      } else {
        await api.checkInById(attendee.id);
        showToast(`${attendee.name} checked in.`);
      }
      fetchAttendees(); fetchEventDetails();
    } catch (err: any) { showToast(err.message || 'Something went wrong.', true); }
  };

  const handleResendTicket = async (attendee: IAttendee) => {
    setResendingAttendeeId(attendee.id);
    try {
      const res = await api.resendTicket(attendee.id);
      showToast(res.message || `Ticket sent to ${attendee.email}`);
      fetchAttendees();
    } catch (err: any) { showToast(`Email failed: ${err.message}`, true); }
    finally { setResendingAttendeeId(null); }
  };

  const handleExportCSV = () => {
    if (!selectedEventId) return;
    window.open(`/api/events/${selectedEventId}/export/attendees.csv`, '_blank');
  };

  const handleCopyLink = () => {
    if (!selectedEventId) return;
    const url = new URL('/register', window.location.origin);
    url.searchParams.set('eventId', selectedEventId);
    navigator.clipboard.writeText(url.toString());
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const toggleAttendeeSelection = (id: string) =>
    setSelectedAttendeeIds((cur) => cur.includes(id) ? cur.filter((i) => i !== id) : [...cur, id]);

  const toggleAllAttendees = () =>
    setSelectedAttendeeIds((cur) => cur.length === attendees.length ? [] : attendees.map((a) => a.id));

  const handleBulkAdmit = async () => {
    const pending = attendees.filter((a) => selectedAttendeeIds.includes(a.id) && !a.checkedInAt);
    if (!pending.length) return;
    try {
      await Promise.all(pending.map((a) => api.checkInById(a.id)));
      setSelectedAttendeeIds([]);
      showToast(`${pending.length} checked in.`);
      fetchAttendees(); fetchEventDetails();
    } catch (err: any) { showToast(err.message || 'Bulk check-in failed.', true); }
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent) return;
    setDeletingEvent(true);
    setDeleteError(null);
    try {
      const name = selectedEvent.name;
      const id = selectedEvent.id;
      await api.deleteEvent(id);
      setShowDeleteModal(false);
      showToast(`"${name}" deleted.`);
      const remaining = events.filter((e) => e.id !== id);
      setEvents(remaining);
      if (remaining.length > 0) {
        setSelectedEventId(remaining[0].id);
      } else {
        setSelectedEventId('');
        setSelectedEvent(null);
        setAttendees([]);
        setAnalytics(null);
      }
    } catch (err: any) {
      setDeleteError(err.message || 'Could not delete the event.');
    } finally {
      setDeletingEvent(false);
    }
  };

  const goToSuperAdmin = () => (onNavigateToSuperAdmin ? onNavigateToSuperAdmin() : (window.location.href = '/super-admin'));
  const goToGuests = () => document.getElementById('guests')?.scrollIntoView({ behavior: 'smooth' });

  const checkedIn = analytics?.checkedInCount || 0;
  const registered = analytics?.registeredCount || 0;
  const notArrived = Math.max(0, registered - checkedIn);
  const last15 = analytics?.recentCheckInRate || 0;
  const pct = registered > 0 ? Math.round((checkedIn / registered) * 100) : 0;

  // Chart data comes straight from analytics. No data, no chart.
  const series = (analytics?.checkInsOverTime || []).slice(-10).map((p: any) => ({
    count: Number(p.count) || 0,
    label: String(p.time ?? p.label ?? p.hour ?? p.bucket ?? ''),
  }));
  const chartMax = Math.max(...series.map((s) => s.count), 1);
  const hasChart = series.some((s) => s.count > 0);

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const meta = selectedEvent ? statusMeta[selectedEvent.status] : null;

  const statusTabs = [
    { key: 'all', label: 'Everyone' },
    { key: 'checked-in', label: 'Checked in' },
    { key: 'not-checked-in', label: 'Not arrived' },
  ];

  const navItem = (active: boolean) =>
    `flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${active ? BRAND_ACCENT : 'text-stone-600 hover:bg-[#f0f3f2]'}`;

  return (
    <div className="min-h-screen bg-[#e4e8e7] p-0 text-stone-900 lg:p-6">
      <div className="mx-auto flex min-h-screen max-w-[1440px] overflow-hidden bg-[#f1f5f4] lg:min-h-[calc(100vh-3rem)] lg:rounded-[28px]">
        {/* Sidebar */}
        <aside className="hidden w-60 shrink-0 flex-col bg-white/60 px-4 py-6 lg:flex">
          <div className="mb-8 flex items-center gap-2.5 px-2">
            <BrandLogo className="h-8 w-8 rounded-lg" />
            <span className="text-lg font-bold tracking-tight">GateKeeper</span>
          </div>
          <nav className="space-y-1">
            <button className={navItem(true)}><LayoutDashboard size={17} /> Dashboard</button>
            <button className={navItem(false)} onClick={() => selectedEvent && onEnterLiveMode(selectedEvent.id)}><QrCode size={17} /> Scanner</button>
            <button className={navItem(false)} onClick={goToGuests}><Users size={17} /> Guests</button>
            <button className={navItem(false)} onClick={() => selectedEvent && onViewAuditLog(selectedEvent.id)}><ClipboardList size={17} /> Audit log</button>
            <button className={navItem(false)} onClick={goToSuperAdmin}><ShieldCheck size={17} /> Super admin</button>
          </nav>
          <div className="mt-auto flex items-center gap-3 px-2 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d8d2fb] text-sm font-bold text-stone-800">{initialsOf(organizer?.name)}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{organizer?.name || 'Organizer'}</div>
              <button onClick={logout} className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-900"><LogOut size={12} /> Log out</button>
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:py-7">
          {/* Mobile top bar */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 lg:hidden">
            <span className="min-w-0 text-lg font-bold tracking-tight">GateKeeper</span>
            <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-sm text-stone-600">
              <button onClick={() => selectedEvent && onEnterLiveMode(selectedEvent.id)}>Scanner</button>
              <button onClick={goToGuests}>Guests</button>
              <button onClick={logout}>Log out</button>
            </div>
          </div>

          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
              <p className="mt-0.5 text-sm text-stone-500">{today}</p>
            </div>
            <button onClick={() => setShowCreateModal(true)} className={btnBrand}><Plus size={16} /> New event</button>
          </header>

          {toast && (
            <div role="status" className={`fixed right-4 top-4 z-50 max-w-sm rounded-xl px-4 py-3 text-sm shadow-lg ${toast.error ? 'bg-red-700 text-white' : 'bg-stone-900 text-white'}`}>
              {toast.msg}
            </div>
          )}

          {loadingEvents ? (
            <div className="mt-6 h-40 animate-pulse rounded-2xl bg-white" />
          ) : events.length === 0 ? (
            <div className={`${panel} mt-6 py-16 text-center`}>
              <h2 className="text-xl font-bold">Create your first event</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-stone-500">
                Add a date and venue, publish it, then share the sign-up link. Guests get a QR ticket by email.
              </p>
              <button onClick={() => setShowCreateModal(true)} className={`${btnBrand} mt-6`}><Plus size={16} /> New event</button>
            </div>
          ) : (
            <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
              {/* Left column */}
              <div className="min-w-0 space-y-5">
                {/* Pastel stats */}
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl bg-[#dcd7fb] p-5">
                    <p className="text-xs font-medium text-stone-700">Registered</p>
                    <p className="mt-3 text-3xl font-bold tabular-nums">{registered}</p>
                    <p className="mt-1 text-xs text-stone-600">{selectedEvent?.name}</p>
                  </div>
                  <div className="rounded-2xl bg-[#c3dcfb] p-5">
                    <p className="text-xs font-medium text-stone-700">Checked in</p>
                    <p className="mt-3 text-3xl font-bold tabular-nums">{checkedIn}</p>
                    <p className="mt-1 text-xs text-stone-600">{notArrived} still to arrive</p>
                  </div>
                  <div className="rounded-2xl bg-[#b0e9c9] p-5">
                    <p className="text-xs font-medium text-stone-700">Arrival rate</p>
                    <p className="mt-3 text-3xl font-bold tabular-nums">{pct}%</p>
                    <p className="mt-1 text-xs text-stone-600">{last15} in the last 15 min</p>
                  </div>
                </div>

                {/* Chart + quick actions */}
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                  <div className={panel}>
                    <div className="flex items-center justify-between">
                      <h2 className="font-semibold">Check-ins over time</h2>
                      <button onClick={handleExportCSV} className="rounded-lg brand-gradient px-3 py-1 text-xs font-semibold hover:brightness-110">Export</button>
                    </div>
                    {hasChart ? (
                      <div className="mt-5 flex h-44 items-end gap-2 border-b border-stone-200">
                        {series.map((s, i) => (
                          <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                            <span className="text-[10px] tabular-nums text-stone-500">{s.count}</span>
                            <div
                              className={`w-full max-w-[28px] rounded-t-md ${i === series.length - 1 ? 'bg-[#6fd9a0]' : 'bg-[#cfc9f7]'}`}
                              style={{ height: `${Math.max(4, (s.count / chartMax) * 100)}%` }}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-5 flex h-44 items-center justify-center rounded-xl bg-[#f4f7f6] text-center text-sm text-stone-500">
                        Check-ins will chart here once the gates open.
                      </div>
                    )}
                    {hasChart && (
                      <div className="mt-2 flex gap-2">
                        {series.map((s, i) => (
                          <span key={i} className="flex-1 truncate text-center text-[10px] text-stone-400">{s.label}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className={panel}>
                    <h2 className="font-semibold">Shortcuts</h2>
                    <p className="text-xs text-stone-500">Things you'll need on the day</p>
                    <div className="mt-4 space-y-2">
                      {[
                        { label: 'Open scanner', onClick: () => selectedEvent && onEnterLiveMode(selectedEvent.id) },
                        { label: 'View audit log', onClick: () => selectedEvent && onViewAuditLog(selectedEvent.id) },
                        { label: 'Download guest list', onClick: handleExportCSV },
                      ].map((row) => (
                        <button key={row.label} onClick={row.onClick} className="flex w-full items-center justify-between rounded-xl bg-[#f4f7f6] px-4 py-3 text-sm font-medium text-stone-700 transition hover:bg-[#e9eeec]">
                          {row.label} <ChevronRight size={15} className="text-stone-400" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Guests */}
                <div id="guests" className={panel}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-lg font-semibold">
                      Guests <span className="ml-1 text-sm font-normal text-stone-400">{totalAttendees}</span>
                    </h2>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <div className="relative sm:w-64">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                        <input
                          ref={searchInputRef}
                          type="text"
                          placeholder="Search name or ticket"
                          value={searchQuery}
                          onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                          className={`${field} pl-9`}
                        />
                      </div>
                      <select
                        value={typeFilter}
                        onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                        className={`${field} sm:w-36`}
                        aria-label="Filter by pass type"
                      >
                        <option value="ALL">All passes</option>
                        <option value="VIP">VIP</option>
                        <option value="Regular">Regular</option>
                        <option value="Speaker">Speaker</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-4 inline-flex rounded-xl bg-[#f0f3f2] p-1">
                    {statusTabs.map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => { setStatusFilter(tab.key); setPage(1); }}
                        className={`rounded-lg px-3.5 py-1.5 text-sm transition ${statusFilter === tab.key ? 'bg-white font-semibold shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {selectedAttendeeIds.length > 0 && (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#eefbc4] px-4 py-2.5 text-sm">
                      <span className="font-medium">{selectedAttendeeIds.length} selected</span>
                      <div className="flex gap-2">
                        <button onClick={handleBulkAdmit} className={btnDark}>Check in selected</button>
                        <button onClick={() => setSelectedAttendeeIds([])} className={btnSoft}>Clear</button>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-stone-200 text-xs text-stone-400">
                          <th className="w-9 py-3 pr-2 font-medium">
                            <input type="checkbox" checked={attendees.length > 0 && selectedAttendeeIds.length === attendees.length} onChange={toggleAllAttendees} className="accent-stone-900" aria-label="Select all" />
                          </th>
                          <th className="py-3 pr-4 font-medium">Name</th>
                          <th className="hidden py-3 pr-4 font-medium sm:table-cell">Ticket</th>
                          <th className="hidden py-3 pr-4 font-medium md:table-cell">Pass</th>
                          <th className="py-3 pr-4 font-medium">Status</th>
                          <th className="py-3 text-right font-medium"><span className="sr-only">Actions</span></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {loadingAttendees ? (
                          <tr><td colSpan={6} className="py-12 text-center text-stone-400">Loading…</td></tr>
                        ) : attendeeListError ? (
                          <tr>
                            <td colSpan={6} className="py-12 text-center">
                              <p className="font-medium text-red-700">Could not load the guest list.</p>
                              <p className="mt-1 text-sm text-stone-500">{attendeeListError}</p>
                              <button onClick={fetchAttendees} className={`${btnSoft} mt-4`}>Try again</button>
                            </td>
                          </tr>
                        ) : attendees.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-14 text-center">
                              {searchQuery || statusFilter !== 'all' || typeFilter !== 'ALL' ? (
                                <p className="font-medium text-stone-700">No one matches that filter.</p>
                              ) : (
                                <>
                                  <p className="font-semibold">Nobody has registered yet</p>
                                  <p className="mt-1 text-stone-500">Share the sign-up link and guests will appear here.</p>
                                  <button onClick={handleCopyLink} className={`${btnBrand} mt-4`}><Copy size={15} /> {copiedLink ? 'Copied' : 'Copy sign-up link'}</button>
                                </>
                              )}
                            </td>
                          </tr>
                        ) : (
                          attendees.map((a) => (
                            <tr key={a.id} className="hover:bg-[#f7faf9]">
                              <td className="py-3 pr-2">
                                <input type="checkbox" checked={selectedAttendeeIds.includes(a.id)} onChange={() => toggleAttendeeSelection(a.id)} className="accent-stone-900" aria-label={`Select ${a.name}`} />
                              </td>
                              <td className="py-3 pr-4">
                                <div className="flex items-center gap-3">
                                  <div className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#dcd7fb] text-xs font-bold text-stone-700 sm:flex">{initialsOf(a.name)}</div>
                                  <div className="min-w-0">
                                    <div className="truncate font-medium">{a.name}</div>
                                    <div className="truncate text-xs text-stone-500">{a.email}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="hidden py-3 pr-4 font-mono text-xs text-stone-500 sm:table-cell">{a.ticketCode}</td>
                              <td className="hidden py-3 pr-4 md:table-cell">{a.ticketType}</td>
                              <td className="py-3 pr-4">
                                {a.checkedInAt ? (
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">Checked in</span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">Not arrived</span>
                                )}
                              </td>
                              <td className="py-3">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => handleToggleCheckIn(a)}
                                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${a.checkedInAt ? 'bg-[#f0f3f2] text-stone-600 hover:bg-[#e6ebe9]' : BRAND_ACCENT}`}
                                  >
                                    {a.checkedInAt ? 'Undo' : 'Check in'}
                                  </button>
                                  <button onClick={() => setQrModalAttendee(a)} className="rounded-lg p-1.5 text-stone-500 hover:bg-[#f0f3f2] hover:text-stone-900" title="Show QR code" aria-label="Show QR code"><QrCode size={16} /></button>
                                  <button
                                    onClick={() => handleResendTicket(a)}
                                    disabled={resendingAttendeeId === a.id}
                                    className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-stone-500 hover:bg-[#f0f3f2] hover:text-stone-900 disabled:cursor-wait disabled:opacity-50"
                                    title="Resend QR ticket email"
                                    aria-label={`Resend QR ticket email to ${a.email}`}
                                  >
                                    <Mail size={15} /> <span>Resend</span>
                                  </button>
                                </div>
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
                        <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className={btnSoft}>Previous</button>
                        <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className={btnSoft}>Next</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right column */}
              <div className="space-y-5">
                {selectedEvent && (
                  <div className="relative overflow-hidden rounded-2xl bg-[#1f8f8a] p-5 text-white">
                    <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10" />
                    <div className="pointer-events-none absolute -bottom-10 right-10 h-24 w-24 rounded-full bg-white/10" />
                    <h2 className="relative text-lg font-semibold">Get people signed up</h2>
                    <p className="relative mt-1 text-sm text-white/80">Share one link. Guests register and get their QR ticket by email.</p>
                    <button onClick={handleCopyLink} className={`${btnBrand} relative mt-4`}>
                      <Copy size={15} /> {copiedLink ? 'Link copied' : 'Copy sign-up link'}
                    </button>
                  </div>
                )}

                {selectedEvent && (
                  <div className={panel}>
                    <div className="flex items-center gap-2 text-sm text-stone-500">
                      {meta && <span className={`h-2 w-2 rounded-full ${meta.dot}`} />}
                      {meta?.label}
                    </div>
                    <h2 className="mt-1 text-lg font-semibold leading-snug">{selectedEvent.name}</h2>
                    <p className="mt-1 text-sm text-stone-500">{selectedEvent.date} · {selectedEvent.venue}</p>
                    <div className="mt-4">
                      {selectedEvent.status === 'DRAFT' && <button onClick={handlePublish} className={`${btnDark} w-full`}>Publish event</button>}
                      {selectedEvent.status === 'UPCOMING' && <button onClick={handleStartEvent} className={`${btnDark} w-full`}><QrCode size={15} /> Start check-in</button>}
                      {selectedEvent.status === 'LIVE' && <button onClick={() => onEnterLiveMode(selectedEvent.id)} className={`${btnDark} w-full`}><QrCode size={15} /> Open scanner</button>}
                      {selectedEvent.status === 'ENDED' && <button onClick={() => onEnterLiveMode(selectedEvent.id)} className={`${btnSoft} w-full`}>View scanner</button>}
                    </div>
                    <button
                      onClick={() => { setDeleteError(null); setShowDeleteModal(true); }}
                      className="mt-4 inline-flex items-center gap-1.5 text-xs text-red-700 hover:underline"
                    >
                      <Trash2 size={13} /> Delete event
                    </button>
                  </div>
                )}

                <div className={panel}>
                  <h2 className="font-semibold">Your events</h2>
                  <div className="mt-3 space-y-2">
                    {events.map((ev) => {
                      const m = statusMeta[ev.status];
                      const active = ev.id === selectedEventId;
                      return (
                        <button
                          key={ev.id}
                          onClick={() => { setSelectedEventId(ev.id); setPage(1); setSelectedAttendeeIds([]); }}
                          className={`flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-left transition ${active ? 'bg-[#eefbc4]' : 'bg-[#f4f7f6] hover:bg-[#e9eeec]'}`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{ev.name}</span>
                            <span className="flex items-center gap-1.5 text-xs text-stone-500">
                              {m && <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />} {ev.date}
                            </span>
                          </span>
                          <ChevronRight size={15} className="shrink-0 text-stone-400" />
                        </button>
                      );
                    })}
                  </div>
                  <button onClick={() => setShowCreateModal(true)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#c3dcfb] py-2.5 text-sm font-semibold text-stone-800 transition hover:bg-[#b2d1f8]">
                    <Plus size={15} /> Add event
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create event */}
      {showCreateModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-stone-900/50 p-4" onClick={() => setShowCreateModal(false)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
              <h3 className="text-lg font-semibold">New event</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-stone-400 hover:text-stone-900" aria-label="Close">✕</button>
            </div>
            <form onSubmit={handleCreateEvent} className="space-y-4 p-6">
              {createError && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{createError}</div>}
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Event name</span>
                <input type="text" required value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} placeholder="Developer Summit" className={field} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Description <span className="font-normal text-stone-400">(optional)</span></span>
                <textarea rows={2} value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} className={`${field} resize-none`} />
              </label>
              <div className="text-sm">
                <span className="mb-1 block font-medium">Event image <span className="font-normal text-stone-400">(optional)</span></span>
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleEventImageChange} className="block w-full text-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#f0f3f2] file:px-3 file:py-2 file:text-sm file:font-medium file:text-stone-700 hover:file:bg-[#e6ebe9]" />
                <p className="mt-1 text-xs text-stone-500">Shown on the sign-up page. Up to 2 MB.</p>
                {createForm.imageDataUrl && (
                  <div className="mt-3 flex items-center gap-3">
                    <img src={createForm.imageDataUrl} alt="Preview" className="h-16 w-24 rounded-lg border border-stone-200 object-cover" />
                    <button type="button" onClick={() => setCreateForm({ ...createForm, imageDataUrl: null })} className="text-sm text-red-700 hover:underline">Remove</button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Date</span>
                  <input type="date" required value={createForm.date} onChange={(e) => setCreateForm({ ...createForm, date: e.target.value })} className={field} />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Start time</span>
                  <input type="text" required value={createForm.startTime} onChange={(e) => setCreateForm({ ...createForm, startTime: e.target.value })} placeholder="10:00 AM" className={field} />
                </label>
              </div>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Venue</span>
                <input type="text" required value={createForm.venue} onChange={(e) => setCreateForm({ ...createForm, venue: e.target.value })} placeholder="Main Hall" className={field} />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Capacity</span>
                  <input type="number" required min={1} value={createForm.capacity} onChange={(e) => setCreateForm({ ...createForm, capacity: Number(e.target.value) })} className={field} />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Ticket prefix</span>
                  <input type="text" required maxLength={8} value={createForm.prefix} onChange={(e) => setCreateForm({ ...createForm, prefix: e.target.value.toUpperCase() })} placeholder="EVT" className={`${field} font-mono uppercase`} />
                </label>
              </div>
              <div className="flex justify-end gap-2 border-t border-stone-100 pt-4">
                <button type="button" onClick={() => setShowCreateModal(false)} className={btnSoft}>Cancel</button>
                <button type="submit" disabled={creatingEvent} className={btnBrand}>{creatingEvent ? 'Saving…' : 'Save event'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR */}
      {qrModalAttendee && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-stone-900/50 p-4" onClick={() => setQrModalAttendee(null)}>
          <div className="w-full max-w-xs rounded-2xl bg-white p-6 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-lg font-semibold">{qrModalAttendee.name}</h4>
            <p className="text-sm text-stone-500">{qrModalAttendee.email}</p>
            <div className="my-5 inline-block rounded-xl border border-stone-200 p-2">
              {qrModalUrl
                ? <img src={qrModalUrl} alt="Ticket QR code" className="block h-48 w-48" />
                : <div className="flex h-48 w-48 items-center justify-center font-mono text-sm">{qrModalAttendee.ticketCode}</div>}
            </div>
            <div className="select-all font-mono text-base tracking-wide">{qrModalAttendee.ticketCode}</div>
            <button onClick={() => setQrModalAttendee(null)} className={`${btnSoft} mt-5 w-full`}>Close</button>
          </div>
        </div>
      )}

      {/* Delete */}
      {showDeleteModal && selectedEvent && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-stone-900/50 p-4" onClick={() => !deletingEvent && setShowDeleteModal(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">Delete "{selectedEvent.name}"?</h3>
            <p className="mt-2 text-sm text-stone-600">
              This permanently removes the event, its {registered} registered guest{registered === 1 ? '' : 's'}, their tickets and the check-in history. It can't be undone.
            </p>
            {deleteError && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{deleteError}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button disabled={deletingEvent} onClick={() => setShowDeleteModal(false)} className={btnSoft}>Keep it</button>
              <button disabled={deletingEvent} onClick={handleDeleteEvent} className="inline-flex items-center rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-50">
                {deletingEvent ? 'Deleting…' : 'Delete event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};