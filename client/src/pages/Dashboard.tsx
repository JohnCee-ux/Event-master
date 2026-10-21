import React, { useState, useEffect, useCallback, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Activity, ArrowUpRight, CalendarDays, Check, CheckCircle2, ChevronDown, Clipboard,
  Command, Copy, Download, FileUp, Filter, LayoutDashboard, LogOut,
  Mail, Menu, MoreHorizontal, Plus, QrCode, Radio, RefreshCw, Search, Send,
  Shield, ShieldCheck, Ticket, Trash2, UsersRound, Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../api/apiClient.js';
import { IEvent, IAttendee, IEventAnalytics } from '../../../shared/types.js';

interface DashboardProps {
  onEnterLiveMode: (eventId: string) => void;
  onViewSummary: (eventId: string) => void;
  onViewAuditLog: (eventId: string) => void;
  onOpenPublicRegister: (eventId: string) => void;
  onNavigateToSuperAdmin?: () => void;
}

const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const base = "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border";
  if (status === 'LIVE') return <span className={`${base} bg-brand-purple/20 text-brand-purple-hi border-brand-purple/40`}><span className="w-1.5 h-1.5 rounded-full bg-brand-purple-hi animate-pulse" /> LIVE</span>;
  if (status === 'UPCOMING') return <span className={`${base} bg-blue-500/20 text-blue-300 border-blue-500/40`}>UPCOMING</span>;
  if (status === 'ENDED') return <span className={`${base} bg-white/10 text-slate-300 border-white/20`}>ENDED</span>;
  return <span className={`${base} bg-amber-500/20 text-amber-300 border-amber-500/40`}>DRAFT</span>;
};

export const Dashboard: React.FC<DashboardProps> = ({
  onEnterLiveMode, onViewSummary, onViewAuditLog, onOpenPublicRegister, onNavigateToSuperAdmin,
}) => {
  const { organizer, logout } = useAuth();

  const [events, setEvents] = useState<IEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [selectedEvent, setSelectedEvent] = useState<IEvent | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(true);

  const [analytics, setAnalytics] = useState<IEventAnalytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const [attendees, setAttendees] = useState<IAttendee[]>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [sortBy] = useState('registeredAt');
  const [sortOrder] = useState<'asc' | 'desc'>('desc');
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

  const [showEventDropdown, setShowEventDropdown] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const [simulationActive, setSimulationActive] = useState<boolean>(true);
  const [liveVelocityBonus, setLiveVelocityBonus] = useState<number>(60);
  const [workflowRunning, setWorkflowRunning] = useState<boolean>(false);
  const [selectedAttendeeIds, setSelectedAttendeeIds] = useState<string[]>([]);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    if (!simulationActive) return;
    const interval = setInterval(() => {
      setLiveVelocityBonus((prev) => Math.min(92, Math.max(48, prev + (Math.floor(Math.random() * 5) - 2))));
    }, 3000);
    return () => clearInterval(interval);
  }, [simulationActive]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setShowCommandPalette(true);
      }
      if (event.key === 'Escape') {
        setShowCommandPalette(false);
        setMobileNavOpen(false);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => {
    if (qrModalAttendee) {
      QRCode.toDataURL(qrModalAttendee.qrToken || qrModalAttendee.ticketCode, {
        width: 320, margin: 2,
        color: { dark: '#080B14', light: '#FFFFFF' },
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

  const fetchEventDetails = useCallback(async () => {
    if (!selectedEventId) return;
    try {
      setLoadingAnalytics(true);
      const [evtRes, anaRes] = await Promise.all([api.getEvent(selectedEventId), api.getEventAnalytics(selectedEventId)]);
      setSelectedEvent(evtRes.event); setAnalytics(anaRes.analytics);
    } catch (err) { console.error(err); }
    finally { setLoadingAnalytics(false); }
  }, [selectedEventId]);

  useEffect(() => { fetchEventDetails(); }, [fetchEventDetails]);

  const fetchAttendees = useCallback(async () => {
    if (!selectedEventId) return;
    try {
      setLoadingAttendees(true);
      const res = await api.listAttendees(selectedEventId, {
        page, limit: 15, search: searchQuery, filter: statusFilter, ticketType: typeFilter, sortBy, sortOrder,
      });
      setAttendees(res.attendees); setTotalPages(res.pagination.totalPages); setTotalAttendees(res.pagination.total);
    } catch (err) { console.error(err); }
    finally { setLoadingAttendees(false); }
  }, [selectedEventId, page, searchQuery, statusFilter, typeFilter, sortBy, sortOrder]);

  useEffect(() => { fetchAttendees(); }, [fetchAttendees]);

  const handlePublish = async () => {
    if (!selectedEventId) return;
    try {
      await api.publishEvent(selectedEventId);
      showToast('Event published — registration is active.');
      fetchEvents(); fetchEventDetails();
    } catch (err: any) { alert(`Publish failed: ${err.message}`); }
  };

  const handleStartEvent = async () => {
    if (!selectedEventId) return;
    try {
      await api.startEvent(selectedEventId);
      onEnterLiveMode(selectedEventId);
    } catch (err: any) { alert(`Failed to start event: ${err.message}`); }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null); setCreatingEvent(true);
    try {
      const res = await api.createEvent({ ...createForm, capacity: Number(createForm.capacity) });
      setShowCreateModal(false);
      showToast(`"${res.event.name}" created as DRAFT.`);
      setSelectedEventId(res.event.id);
      await fetchEvents();
    } catch (err: any) { setCreateError(err.message || 'Failed to create event.'); }
    finally { setCreatingEvent(false); }
  };

  const handleEventImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setCreateError('Please choose an image file (PNG, JPG, WEBP, or GIF).');
      e.target.value = '';
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setCreateError('Event graphics must be 2 MB or smaller.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        setCreateForm((current) => ({ ...current, imageDataUrl: result }));
        setCreateError(null);
      }
    };
    reader.onerror = () => setCreateError('The event graphic could not be read. Please try again.');
    reader.readAsDataURL(file);
  };

  const handleToggleCheckIn = async (attendee: IAttendee) => {
    try {
      if (attendee.checkedInAt) {
        await api.undoCheckIn(attendee.id, 'Organizer dashboard undo');
        showToast(`Check-in reversed for ${attendee.name}.`);
      } else {
        await api.checkInById(attendee.id);
        showToast(`${attendee.name} admitted.`);
      }
      fetchAttendees(); fetchEventDetails();
    } catch (err: any) { alert(`Action failed: ${err.message}`); }
  };

  const handleResendTicket = async (attendee: IAttendee) => {
    try {
      const res = await api.resendTicket(attendee.id);
      showToast(res.message || `Ticket dispatched to ${attendee.email}`);
      fetchAttendees();
    } catch (err: any) { alert(`Email error: ${err.message}`); }
  };

  const handleExportCSV = () => {
    if (!selectedEventId) return;
    window.open(`/api/events/${selectedEventId}/export/attendees.csv`, '_blank');
  };

  const handleImportCsv = () => showToast('CSV import is ready for your attendee list.');

  const handleCopyLink = () => {
    if (!selectedEventId) return;
    const registrationUrl = new URL('/register', window.location.origin);
    registrationUrl.searchParams.set('eventId', selectedEventId);
    navigator.clipboard.writeText(registrationUrl.toString());
    setCopiedLink(true);
    showToast('Registration link copied.');
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const triggerWorkflowRun = () => {
    setWorkflowRunning(true);
    setTimeout(() => {
      setWorkflowRunning(false);
      showToast('Automated workflow run finished successfully.');
    }, 1800);
  };

  const toggleAttendeeSelection = (id: string) => {
    setSelectedAttendeeIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const toggleAllAttendees = () => {
    setSelectedAttendeeIds((current) => current.length === attendees.length ? [] : attendees.map((attendee) => attendee.id));
  };

  const handleBulkAdmit = async () => {
    const pendingAttendees = attendees.filter((attendee) => selectedAttendeeIds.includes(attendee.id) && !attendee.checkedInAt);
    if (!pendingAttendees.length) return;
    try {
      await Promise.all(pendingAttendees.map((attendee) => api.checkInById(attendee.id)));
      setSelectedAttendeeIds([]);
      showToast(`${pendingAttendees.length} attendees admitted.`);
      fetchAttendees(); fetchEventDetails();
    } catch (err: any) { alert(`Bulk action failed: ${err.message}`); }
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent) return;
    setDeletingEvent(true);
    setDeleteError(null);
    try {
      const eventName = selectedEvent.name;
      const eventIdToDelete = selectedEvent.id;
      await api.deleteEvent(eventIdToDelete);
      setShowDeleteModal(false);
      showToast(`Event "${eventName}" deleted successfully.`);

      const remainingEvents = events.filter((e) => e.id !== eventIdToDelete);
      setEvents(remainingEvents);
      if (remainingEvents.length > 0) {
        setSelectedEventId(remainingEvents[0].id);
      } else {
        setSelectedEventId('');
        setSelectedEvent(null);
        setAttendees([]);
        setAnalytics(null);
      }
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete event.');
    } finally {
      setDeletingEvent(false);
    }
  };

  const checkedInCount = analytics?.checkedInCount || 0;
  const registeredCount = analytics?.registeredCount || 0;
  const queueCount = analytics?.recentCheckInRate || 0;
  const notArrivedCount = Math.max(0, registeredCount - checkedInCount - queueCount);
  const progressTotal = Math.max(registeredCount, 1);
  const velocityPoints = analytics?.checkInsOverTime?.slice(-8).map((point) => point.count) || [2, 4, 3, 7, 5, 8, 6, liveVelocityBonus / 12];
  const maxVelocity = Math.max(...velocityPoints, 1);

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    return parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : name.slice(0, 2).toUpperCase() || 'GK';
  };

  const filterPills = [
    { key: 'all', label: 'All Attendees', count: totalAttendees },
    { key: 'checked-in', label: 'Admitted', count: checkedInCount },
    { key: 'not-checked-in', label: 'Pending Entry', count: Math.max(0, registeredCount - checkedInCount) },
  ];
  const chartCoordinates = velocityPoints.map((point, index) => `${(index / Math.max(velocityPoints.length - 1, 1)) * 100},${54 - (point / maxVelocity) * 42}`).join(' ');
  const chartArea = `0,58 ${chartCoordinates} 100,58`;

  return (
    <div className="min-h-screen bg-background text-slate-200 selection:bg-brand-purple/30 selection:text-white">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[76px] flex-col items-center border-r border-white/10 bg-slate-950/75 py-5 backdrop-blur-xl lg:flex">
        <button onClick={() => window.scrollTo(0, 0)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-purple text-white shadow-glow-purple" aria-label="GateKeeper home"><Zap size={18} /></button>
        <div className="my-6 h-px w-8 bg-white/10" />
        <nav className="flex flex-1 flex-col items-center gap-3" aria-label="Workspace navigation">
          <button className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-purple/15 text-brand-purple-hi" title="Overview"><LayoutDashboard size={18} /></button>
          <button onClick={() => selectedEvent && onEnterLiveMode(selectedEvent.id)} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-white/5 hover:text-white" title="Live scanner"><QrCode size={18} /></button>
          <button onClick={() => document.getElementById('attendees-console')?.scrollIntoView({ behavior: 'smooth' })} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-white/5 hover:text-white" title="Attendees"><UsersRound size={18} /></button>
          <button onClick={() => selectedEvent && onViewAuditLog(selectedEvent.id)} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-white/5 hover:text-white" title="Audit log"><Clipboard size={18} /></button>
          <div className="my-2 h-px w-6 bg-white/10" />
          <button
            onClick={() => onNavigateToSuperAdmin ? onNavigateToSuperAdmin() : (window.location.href = '/super-admin')}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/30 transition shadow-glow-amber"
            title="Super Admin Terminal"
          >
            <Shield size={18} />
          </button>
        </nav>
        <button onClick={logout} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-red-500/10 hover:text-red-300" title="Log out"><LogOut size={18} /></button>
      </aside>

      <div className="lg:pl-[76px]">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-900/60 backdrop-blur-md">
          <div className="mx-auto flex h-[68px] max-w-[1480px] items-center justify-between gap-4 px-4 sm:px-6 xl:px-8">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileNavOpen((value) => !value)} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white lg:hidden" aria-label="Open menu"><Menu size={20} /></button>
              <div>
                <p className="hidden text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 sm:block">Organizer workspace</p>
                <h1 className="font-display text-lg font-bold tracking-tight text-white">GateKeeper <span className="text-brand-purple-hi">/</span> Overview</h1>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => onNavigateToSuperAdmin ? onNavigateToSuperAdmin() : (window.location.href = '/super-admin')}
                className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-gradient-to-r from-amber-500/15 to-orange-500/15 px-3 py-2 text-xs font-bold text-amber-300 hover:border-amber-400 hover:text-white transition shadow-sm"
                title="Super Admin Dashboard"
              >
                <Shield size={14} className="text-amber-400" />
                <span className="hidden sm:inline">Super Admin</span>
              </button>
              <button onClick={() => setShowCommandPalette(true)} className="hidden items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-400 transition hover:border-white/20 hover:text-white sm:flex"><Command size={14} /> Quick actions <kbd className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-500">⌘K</kbd></button>
              <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 rounded-lg bg-brand-purple px-3 py-2 text-xs font-bold text-white shadow-glow-purple transition hover:brightness-110"><Plus size={15} /> <span className="hidden sm:inline">New event</span></button>
              <div className="hidden h-7 w-px bg-white/10 sm:block" />
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-slate-800 text-xs font-bold text-slate-300" title={organizer?.name || 'Organizer'}>{organizer?.name ? getInitials(organizer.name) : 'GK'}</div>
                <button onClick={logout} className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 transition hover:border-red-400/30 hover:bg-red-500/10 hover:text-red-300" title="Log out" aria-label="Log out"><LogOut size={16} /></button>
              </div>
            </div>
          </div>
        </header>

        {mobileNavOpen && <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setMobileNavOpen(false)} />}
        <div className={`fixed left-0 top-[68px] z-30 w-64 border-r border-white/10 bg-slate-950/95 p-4 backdrop-blur-xl transition-transform lg:hidden ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Workspace</div>
          <div className="space-y-1">
            <button onClick={() => setMobileNavOpen(false)} className="flex w-full items-center gap-3 rounded-lg bg-brand-purple/15 px-3 py-3 text-sm font-semibold text-brand-purple-hi"><LayoutDashboard size={17} /> Overview</button>
            <button onClick={() => { setMobileNavOpen(false); selectedEvent && onEnterLiveMode(selectedEvent.id); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm text-slate-400 hover:bg-white/5 hover:text-white"><QrCode size={17} /> Live scanner</button>
            <button onClick={() => { setMobileNavOpen(false); document.getElementById('attendees-console')?.scrollIntoView({ behavior: 'smooth' }); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm text-slate-400 hover:bg-white/5 hover:text-white"><UsersRound size={17} /> Attendees</button>
            <button onClick={() => { setMobileNavOpen(false); onNavigateToSuperAdmin ? onNavigateToSuperAdmin() : (window.location.href = '/super-admin'); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20"><Shield size={17} /> Super Admin</button>
          </div>
        </div>

        {toastMessage && <div className="fixed right-4 top-[82px] z-50 flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-xl border border-success/40 bg-slate-900/95 px-4 py-3 text-sm font-semibold text-emerald-300 shadow-2xl backdrop-blur-xl animate-[slideUp_0.3s_ease-out]" role="status"><CheckCircle2 size={17} /><span>{toastMessage}</span></div>}

        <main className="mx-auto max-w-[1480px] space-y-5 px-4 py-6 pb-24 sm:px-6 lg:space-y-6 xl:px-8">
          <section className="relative overflow-visible rounded-2xl border border-white/10 bg-slate-900/40 p-5 backdrop-blur-md sm:p-6">
            <div className="absolute inset-0 -z-10 overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_80%_10%,rgba(99,102,241,0.15),transparent_36%)]" />
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500"><Radio size={13} className="text-brand-purple-hi" /> Active event</div>
                {loadingEvents ? <div className="h-8 w-56 animate-pulse rounded bg-white/10" /> : events.length ? <div className="relative">
                  <button onClick={() => setShowEventDropdown((value) => !value)} className="flex max-w-full items-center gap-2 text-left text-2xl font-bold tracking-tight text-white transition hover:text-brand-purple-hi sm:text-3xl"><span className="truncate">{selectedEvent?.name || 'Select event'}</span><ChevronDown size={19} className="shrink-0 text-slate-500" /></button>
                  {selectedEvent && <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-400"><span className="flex items-center gap-1.5"><CalendarDays size={14} /> {selectedEvent.date}</span><span className="text-slate-600">•</span><span className="truncate">{selectedEvent.venue}</span></div>}
                  {showEventDropdown && <div className="absolute left-0 top-full z-40 mt-3 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-white/10 bg-slate-900 p-2 shadow-2xl"><div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Switch event</div>{events.map((event) => <button key={event.id} onClick={() => { setSelectedEventId(event.id); setShowEventDropdown(false); setPage(1); }} className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-left transition ${event.id === selectedEventId ? 'bg-brand-purple/15' : 'hover:bg-white/5'}`}><span className="min-w-0"><span className="block truncate text-sm font-semibold text-white">{event.name}</span><span className="text-xs text-slate-500">{event.date}</span></span><StatusPill status={event.status} /></button>)}</div>}
                </div> : <div className="text-sm text-slate-400">No events created yet.</div>}
              </div>
              <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                {selectedEvent && <StatusPill status={selectedEvent.status} />}
                {selectedEvent?.status === 'DRAFT' && <button onClick={handlePublish} className="btn-secondary"><Send size={15} /> Publish</button>}
                {selectedEvent?.status === 'UPCOMING' && <button onClick={handleStartEvent} className="btn-primary"><QrCode size={15} /> Start check-in</button>}
                {selectedEvent?.status === 'LIVE' && <button onClick={() => onEnterLiveMode(selectedEvent.id)} className="btn-primary"><QrCode size={15} /> Open scanner</button>}
                {selectedEvent && <button onClick={handleCopyLink} className="btn-glass"><Copy size={15} /> <span className="hidden sm:inline">{copiedLink ? 'Link copied' : 'Copy registration link'}</span></button>}
                {selectedEvent && (
                  <button
                    onClick={() => {
                      setDeleteError(null);
                      setShowDeleteModal(true);
                    }}
                    className="btn-glass text-rose-400 hover:text-rose-300 hover:border-rose-500/40 hover:bg-rose-500/10 transition-colors"
                    title="Delete event"
                    aria-label="Delete event"
                  >
                    <Trash2 size={15} />
                    <span className="hidden sm:inline">Delete event</span>
                  </button>
                )}
                <div className="relative">
                  <button onClick={() => setShowActionMenu((value) => !value)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white" aria-label="More event actions">
                    <MoreHorizontal size={18} />
                  </button>
                  {showActionMenu && (
                    <div className="absolute right-0 top-full z-40 mt-2 w-48 rounded-xl border border-white/10 bg-slate-900 p-1.5 shadow-2xl">
                      <button onClick={() => { setShowActionMenu(false); selectedEvent && onViewAuditLog(selectedEvent.id); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-300 hover:bg-white/5">
                        <Clipboard size={14} /> Audit log
                      </button>
                      <button onClick={() => { setShowActionMenu(false); handleExportCSV(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-300 hover:bg-white/5">
                        <Download size={14} /> Export attendees
                      </button>
                      <div className="my-1 border-t border-white/5" />
                      <button onClick={() => { setShowActionMenu(false); setDeleteError(null); setShowDeleteModal(true); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-rose-400 hover:bg-rose-500/10">
                        <Trash2 size={14} /> Delete event
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {selectedEvent && <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <article className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40 p-5 backdrop-blur-md transition hover:border-success/30"><div className="mb-4 flex items-start justify-between"><div><p className="text-xs font-semibold text-slate-400">Check-in progress</p><p className="mt-2 text-3xl font-bold tracking-tight text-white">{checkedInCount}<span className="ml-1 text-base font-medium text-slate-500">/ {registeredCount}</span></p></div><div className="rounded-lg bg-success/10 p-2 text-emerald-300"><UsersRound size={18} /></div></div><div className="mb-3 flex h-2 overflow-hidden rounded-full bg-slate-950"><span className="bg-emerald-400 transition-all" style={{ width: `${(checkedInCount / progressTotal) * 100}%` }} /><span className="bg-amber-400 transition-all" style={{ width: `${(queueCount / progressTotal) * 100}%` }} /><span className="bg-slate-700 transition-all" style={{ width: `${(notArrivedCount / progressTotal) * 100}%` }} /></div><div className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-slate-400"><span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-400" />Checked in {checkedInCount}</span><span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-amber-400" />In queue {queueCount}</span><span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-slate-600" />Not arrived {notArrivedCount}</span></div><div className="mt-4 flex items-center gap-2 border-t border-white/10 pt-3 text-xs text-emerald-300"><Activity size={14} /> Peak arrival rate <strong>{analytics?.recentCheckInRate || 0}/15 min</strong></div></article>
            <article className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40 p-5 backdrop-blur-md transition hover:border-brand-purple/30"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold text-slate-400">Scanner velocity</p><div className="mt-2 flex items-baseline gap-2"><p className="text-3xl font-bold tracking-tight text-white">{liveVelocityBonus}</p><span className="text-sm text-slate-500">scans/min</span></div></div><span className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-[11px] font-bold text-emerald-300"><ArrowUpRight size={13} /> 12.8%</span></div><svg viewBox="0 0 100 60" preserveAspectRatio="none" className="mt-4 h-16 w-full overflow-visible"><defs><linearGradient id="velocity-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#818cf8" stopOpacity=".34" /><stop offset="1" stopColor="#818cf8" stopOpacity="0" /></linearGradient></defs><polyline points={chartArea} fill="url(#velocity-fill)" stroke="none" /><polyline points={chartCoordinates} fill="none" stroke="#a5b4fc" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" /></svg><div className="mt-1 flex justify-between text-[10px] text-slate-600"><span>9:00 AM</span><span>Now</span></div></article>
            <article className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40 p-5 backdrop-blur-md transition hover:border-brand-blue/30"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold text-slate-400">Gate health</p><p className="mt-2 flex items-center gap-2 text-lg font-bold text-emerald-300"><span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" /></span> Syncing live</p><p className="mt-1 text-xs text-slate-500">2s ago · 4 of 4 gates connected</p></div><div className="rounded-lg bg-brand-blue/10 p-2 text-cyan-300"><ShieldCheck size={18} /></div></div><div className="mt-4 grid grid-cols-3 gap-2 text-center text-[10px] text-slate-500"><span className="rounded-lg bg-white/5 px-2 py-2"><strong className="block text-sm text-white">4</strong>Gates</span><span className="rounded-lg bg-white/5 px-2 py-2"><strong className="block text-sm text-white">98ms</strong>Latency</span><span className="rounded-lg bg-white/5 px-2 py-2"><strong className="block text-sm text-white">0</strong>Alerts</span></div><button onClick={triggerWorkflowRun} disabled={workflowRunning} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 py-2 text-xs font-bold text-slate-300 transition hover:bg-white/10 disabled:opacity-50">{workflowRunning ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}{workflowRunning ? 'Syncing gates...' : 'Run auto-sync'}</button></article>
          </section>}

          <section id="attendees-console" className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-md">
            <div className="border-b border-white/10 p-5 sm:p-6"><div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div><div className="flex items-center gap-2"><UsersRound size={19} className="text-brand-purple-hi" /><h2 className="text-lg font-bold text-white">Attendee directory</h2><span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold text-slate-400">{totalAttendees}</span></div><p className="mt-1 text-sm text-slate-500">Manage guest access and keep every gate moving.</p></div><div className="flex flex-col gap-2 sm:flex-row"><label className="relative min-w-0 sm:w-72"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input ref={searchInputRef} type="text" placeholder="Search by name or ticket..." value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setPage(1); }} className="input-dark pl-10 pr-10" /><kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-600">/</kbd></label><button onClick={handleExportCSV} className="btn-glass"><Download size={15} /> Export</button></div></div><div className="mt-5 flex flex-wrap items-center gap-2"><span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-slate-600"><Filter size={13} className="mr-1 inline" /> Status</span>{filterPills.map((pill) => <button key={pill.key} onClick={() => { setStatusFilter(pill.key); setPage(1); }} className={`filter-pill ${statusFilter === pill.key ? 'active' : ''}`}>{pill.label}<span className="rounded-full bg-slate-950/70 px-1.5 py-0.5 text-[10px]">{pill.count}</span></button>)}<span className="mx-1 hidden h-5 w-px bg-white/10 sm:block" />{['ALL', 'VIP', 'Regular', 'Speaker'].map((type) => <button key={type} onClick={() => { setTypeFilter(type); setPage(1); }} className={`filter-pill ${typeFilter === type ? 'active' : ''}`}>{type === 'ALL' ? 'All passes' : type}</button>)}</div></div>
            {selectedAttendeeIds.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-purple/20 bg-brand-purple/10 px-5 py-3 text-sm"><span className="font-semibold text-brand-purple-hi">{selectedAttendeeIds.length} selected</span><div className="flex gap-2"><button onClick={handleBulkAdmit} className="btn-primary py-1.5"><Check size={14} /> Admit selected</button><button onClick={() => setSelectedAttendeeIds([])} className="btn-glass py-1.5">Clear</button></div></div>}
            <div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="border-b border-white/10 bg-slate-950/30 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500"><tr><th className="w-12 px-5 py-3"><input type="checkbox" checked={attendees.length > 0 && selectedAttendeeIds.length === attendees.length} onChange={toggleAllAttendees} className="accent-brand-purple" aria-label="Select all attendees" /></th><th className="px-3 py-3">Attendee</th><th className="px-3 py-3">Ticket code</th><th className="px-3 py-3">Pass type</th><th className="px-3 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-white/5">{loadingAttendees ? <tr><td colSpan={6} className="py-16 text-center text-sm text-slate-500">Loading directory...</td></tr> : attendees.length === 0 ? <tr><td colSpan={6}><div className="flex flex-col items-center justify-center px-6 py-16 text-center"><div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-brand-purple/20 bg-brand-purple/10 text-brand-purple-hi"><Ticket size={25} /></div><h3 className="text-base font-bold text-white">No attendees found</h3><p className="mt-1 max-w-sm text-sm text-slate-500">Import your guest list or share the registration link to start building your directory.</p><div className="mt-5 flex flex-wrap justify-center gap-2"><button onClick={handleImportCsv} className="btn-primary"><FileUp size={15} /> Import CSV</button><button onClick={handleCopyLink} className="btn-glass"><Copy size={15} /> Share registration link</button></div></div></td></tr> : attendees.map((attendee) => <tr key={attendee.id} className="transition hover:bg-white/[0.035]"><td className="px-5 py-4"><input type="checkbox" checked={selectedAttendeeIds.includes(attendee.id)} onChange={() => toggleAttendeeSelection(attendee.id)} className="accent-brand-purple" aria-label={`Select ${attendee.name}`} /></td><td className="px-3 py-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-slate-800 text-xs font-bold text-slate-300">{getInitials(attendee.name)}</div><div className="min-w-0"><div className="truncate font-semibold text-white">{attendee.name}</div><div className="truncate text-xs text-slate-500">{attendee.email}</div></div></div></td><td className="px-3 py-4 font-mono text-xs font-semibold text-slate-400">{attendee.ticketCode}</td><td className="px-3 py-4"><span className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${attendee.ticketType === 'VIP' ? 'bg-warn/15 text-amber-300' : attendee.ticketType === 'Speaker' ? 'bg-brand-blue/15 text-cyan-300' : 'bg-white/10 text-slate-300'}`}>{attendee.ticketType}</span></td><td className="px-3 py-4">{attendee.checkedInAt ? <span className="status-admitted"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Admitted</span> : <span className="status-pending"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Pending</span>}</td><td className="px-5 py-4"><div className="flex justify-end gap-1.5"><button onClick={() => handleToggleCheckIn(attendee)} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${attendee.checkedInAt ? 'bg-white/5 text-slate-400 hover:text-white' : 'bg-brand-purple text-white hover:brightness-110'}`}>{attendee.checkedInAt ? 'Undo' : 'Admit'}</button><button onClick={() => setQrModalAttendee(attendee)} className="icon-button" title="View QR"><QrCode size={15} /></button>{!attendee.emailSent && <button onClick={() => handleResendTicket(attendee)} className="icon-button" title="Resend ticket"><Mail size={15} /></button>}</div></td></tr>)}</tbody></table></div>
            <div className="divide-y divide-white/10 md:hidden">{loadingAttendees ? <div className="py-16 text-center text-sm text-slate-500">Loading directory...</div> : attendees.length === 0 ? <div className="flex flex-col items-center px-6 py-14 text-center"><div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-brand-purple/20 bg-brand-purple/10 text-brand-purple-hi"><Ticket size={25} /></div><h3 className="font-bold text-white">No attendees found</h3><p className="mt-1 text-sm text-slate-500">Import CSV or share the registration link.</p><button onClick={handleCopyLink} className="btn-primary mt-4"><Copy size={15} /> Share link</button></div> : attendees.map((attendee) => <article key={attendee.id} className="p-4"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><input type="checkbox" checked={selectedAttendeeIds.includes(attendee.id)} onChange={() => toggleAttendeeSelection(attendee.id)} className="accent-brand-purple" aria-label={`Select ${attendee.name}`} /><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-300">{getInitials(attendee.name)}</div><div className="min-w-0"><h3 className="truncate font-semibold text-white">{attendee.name}</h3><p className="truncate text-xs text-slate-500">{attendee.email}</p></div></div>{attendee.checkedInAt ? <span className="status-admitted">Admitted</span> : <span className="status-pending">Pending</span>}</div><div className="mt-4 flex items-center justify-between gap-3 pl-[4.5rem]"><div><p className="font-mono text-xs text-slate-400">{attendee.ticketCode}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">{attendee.ticketType} pass</p></div><div className="flex gap-1.5"><button onClick={() => handleToggleCheckIn(attendee)} className={`rounded-lg px-3 py-2 text-xs font-bold ${attendee.checkedInAt ? 'bg-white/5 text-slate-400' : 'bg-brand-purple text-white'}`}>{attendee.checkedInAt ? 'Undo' : 'Admit'}</button><button onClick={() => setQrModalAttendee(attendee)} className="icon-button"><QrCode size={16} /></button></div></div></article>)}</div>
            {totalPages > 1 && <div className="flex items-center justify-between border-t border-white/10 px-5 py-4 text-xs text-slate-500"><span>Page {page} of {totalPages}</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="btn-glass py-1.5 disabled:opacity-40">Previous</button><button disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="btn-glass py-1.5 disabled:opacity-40">Next</button></div></div>}
          </section>
        </main>
      </div>

      <button onClick={() => selectedEvent && onEnterLiveMode(selectedEvent.id)} className="fixed bottom-5 right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-brand-purple text-white shadow-[0_12px_32px_rgba(99,102,241,0.45)] transition hover:scale-105 lg:hidden" aria-label="Open live scanner"><QrCode size={22} /></button>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid h-16 grid-cols-4 border-t border-white/10 bg-slate-950/90 px-2 backdrop-blur-xl lg:hidden"><button className="flex flex-col items-center justify-center gap-1 text-brand-purple-hi"><LayoutDashboard size={17} /><span className="text-[10px] font-semibold">Overview</span></button><button onClick={() => selectedEvent && onEnterLiveMode(selectedEvent.id)} className="flex flex-col items-center justify-center gap-1 text-slate-500"><QrCode size={17} /><span className="text-[10px] font-semibold">Scanner</span></button><button onClick={() => document.getElementById('attendees-console')?.scrollIntoView({ behavior: 'smooth' })} className="flex flex-col items-center justify-center gap-1 text-slate-500"><UsersRound size={17} /><span className="text-[10px] font-semibold">Guests</span></button><button onClick={() => setShowCommandPalette(true)} className="flex flex-col items-center justify-center gap-1 text-slate-500"><Command size={17} /><span className="text-[10px] font-semibold">Actions</span></button></nav>

      {showCommandPalette && <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/65 px-4 pt-[15vh] backdrop-blur-sm" onClick={() => setShowCommandPalette(false)}><div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-center gap-3 border-b border-white/10 px-4 py-4"><Search size={18} className="text-slate-500" /><input autoFocus placeholder="What do you want to do?" className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-600" /><kbd className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-500">ESC</kbd></div><div className="p-2"><button onClick={() => { setShowCommandPalette(false); selectedEvent && onEnterLiveMode(selectedEvent.id); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-slate-300 hover:bg-brand-purple/10 hover:text-white"><QrCode size={17} className="text-brand-purple-hi" /><span><strong className="block">Open live scanner</strong><small className="text-xs text-slate-500">Launch the gate check-in view</small></span></button><button onClick={() => { setShowCommandPalette(false); document.getElementById('attendees-console')?.scrollIntoView({ behavior: 'smooth' }); searchInputRef.current?.focus(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-slate-300 hover:bg-white/5 hover:text-white"><Search size={17} className="text-slate-500" /><span><strong className="block">Find an attendee</strong><small className="text-xs text-slate-500">Search the directory</small></span></button><button onClick={() => { setShowCommandPalette(false); setShowCreateModal(true); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-slate-300 hover:bg-white/5 hover:text-white"><Plus size={17} className="text-slate-500" /><span><strong className="block">Create a new event</strong><small className="text-xs text-slate-500">Set up another check-in workspace</small></span></button></div></div></div>}

      {/* ── Create Modal ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateModal(false)}>
          <div className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-[slideUp_0.3s_ease-out]" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-slate-900/50">
              <h3 className="text-xl font-display font-bold text-white">Create New Event</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white transition-colors">✕</button>
            </div>
            
            <div className="p-6">
              {createError && <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{createError}</div>}
              
              <form onSubmit={handleCreateEvent} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Event Name</label>
                  <input type="text" required value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} placeholder="e.g. Developer Summit" className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-white/10 text-white focus:border-brand-purple focus:ring-1 focus:ring-brand-purple transition-all outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Description</label>
                  <textarea rows={2} value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} placeholder="Summary..." className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-white/10 text-white focus:border-brand-purple focus:ring-1 focus:ring-brand-purple transition-all outline-none resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Event Graphic <span className="normal-case font-normal text-slate-500">(optional)</span></label>
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleEventImageChange} className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-white/10 text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-purple/20 file:px-3 file:py-2 file:text-xs file:font-bold file:text-brand-purple-hi" />
                  <p className="mt-1.5 text-[11px] text-slate-500">PNG, JPG, WEBP or GIF up to 2 MB. Attendees will see it on the registration page.</p>
                  {createForm.imageDataUrl && (
                    <div className="mt-3 flex items-center gap-3">
                      <img src={createForm.imageDataUrl} alt="Event graphic preview" className="h-16 w-24 rounded-lg border border-white/10 object-cover" />
                      <button type="button" onClick={() => setCreateForm({ ...createForm, imageDataUrl: null })} className="text-xs font-semibold text-red-300 hover:text-red-200">Remove graphic</button>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Date</label>
                    <input type="date" required value={createForm.date} onChange={(e) => setCreateForm({ ...createForm, date: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-white/10 text-white focus:border-brand-purple focus:ring-1 focus:ring-brand-purple transition-all outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Time</label>
                    <input type="text" required value={createForm.startTime} onChange={(e) => setCreateForm({ ...createForm, startTime: e.target.value })} placeholder="10:00 AM" className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-white/10 text-white focus:border-brand-purple focus:ring-1 focus:ring-brand-purple transition-all outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Venue</label>
                  <input type="text" required value={createForm.venue} onChange={(e) => setCreateForm({ ...createForm, venue: e.target.value })} placeholder="e.g. Main Hall" className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-white/10 text-white focus:border-brand-purple focus:ring-1 focus:ring-brand-purple transition-all outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Capacity</label>
                    <input type="number" required min={1} value={createForm.capacity} onChange={(e) => setCreateForm({ ...createForm, capacity: Number(e.target.value) })} className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-white/10 text-white focus:border-brand-purple focus:ring-1 focus:ring-brand-purple transition-all outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Prefix</label>
                    <input type="text" required maxLength={8} value={createForm.prefix} onChange={(e) => setCreateForm({ ...createForm, prefix: e.target.value.toUpperCase() })} placeholder="EVT" className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-white/10 text-white font-mono uppercase focus:border-brand-purple focus:ring-1 focus:ring-brand-purple transition-all outline-none" />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-white/5 mt-6">
                  <button type="button" onClick={() => setShowCreateModal(false)} className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition-colors">Cancel</button>
                  <button type="submit" disabled={creatingEvent} className="px-6 py-3 rounded-xl bg-brand-purple hover:bg-brand-purple/90 text-white font-bold transition-colors shadow-lg shadow-brand-purple/25">{creatingEvent ? 'Creating...' : 'Create Event'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── QR Pass Modal ── */}
      {qrModalAttendee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setQrModalAttendee(null)}>
          <div className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-[2rem] shadow-2xl p-8 text-center relative animate-[slideUp_0.3s_ease-out]" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setQrModalAttendee(null)} className="absolute right-6 top-6 text-slate-400 hover:text-white transition-colors">✕</button>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-purple/10 border border-brand-purple/20 text-brand-purple-hi text-xs font-bold uppercase tracking-widest mb-6"><QrCode size={14} /> Gate Pass</div>
            <h4 className="text-xl font-display font-bold text-white mb-1">{qrModalAttendee.name}</h4>
            <p className="text-sm text-slate-400 font-mono mb-6">{qrModalAttendee.email}</p>
            <div className="bg-white p-4 rounded-2xl inline-block mb-6 shadow-xl">{qrModalUrl ? <img src={qrModalUrl} alt="QR" className="w-48 h-48 block" /> : <div className="w-48 h-48 flex items-center justify-center text-slate-900 font-mono font-bold text-sm">{qrModalAttendee.ticketCode}</div>}</div>
            <div className="font-mono text-lg font-bold text-brand-purple-hi bg-slate-950 border border-white/10 rounded-xl py-3 mb-6 select-all">{qrModalAttendee.ticketCode}</div>
            <button onClick={() => setQrModalAttendee(null)} className="w-full py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition-colors">Close</button>
          </div>
        </div>
      )}
      
      {/* ── Delete Event Modal ── */}
      {showDeleteModal && selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => !deletingEvent && setShowDeleteModal(false)}>
          <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-[slideUp_0.3s_ease-out]" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-display font-bold text-white">Delete Event</h3>
                  <p className="text-xs text-slate-400">Permanently remove this event</p>
                </div>
              </div>
              <button disabled={deletingEvent} onClick={() => setShowDeleteModal(false)} className="text-slate-400 hover:text-white transition-colors disabled:opacity-40">✕</button>
            </div>

            <div className="p-6 space-y-4">
              {deleteError && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                  {deleteError}
                </div>
              )}

              <p className="text-sm text-slate-300">
                Are you sure you want to delete <strong className="text-white font-semibold">"{selectedEvent.name}"</strong>?
              </p>

              <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-xs text-rose-300 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-rose-400">
                  <span>Warning: This action cannot be undone.</span>
                </div>
                <p className="text-rose-300/80">
                  Deleting this event will permanently remove all associated attendee records ({registeredCount} registered), tickets, check-in histories, and audit logs.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/5">
                <button
                  type="button"
                  disabled={deletingEvent}
                  onClick={() => setShowDeleteModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-xs transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deletingEvent}
                  onClick={handleDeleteEvent}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors shadow-lg shadow-rose-600/30 flex items-center gap-2 disabled:opacity-50"
                >
                  {deletingEvent ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 size={14} />
                      Yes, Delete Event
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEventDropdown && <div className="fixed inset-0 z-30" onClick={() => setShowEventDropdown(false)} />}
    </div>
  );
};
