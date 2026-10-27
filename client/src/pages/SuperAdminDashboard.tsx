import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, ArrowLeft, Calendar, CheckCircle2, ChevronRight, Database, ExternalLink,
  FileSpreadsheet, LayoutDashboard, Lock, Radio, RefreshCw, Search,
  Ticket, Trash2, Unlock, Users, XCircle,
} from 'lucide-react';
import { api } from '../api/apiClient.js';
import { useAuth } from '../context/AuthContext.js';
import { BrandLogo } from '../components/BrandLogo.js';

interface SuperAdminDashboardProps {
  onBackToDashboard: () => void;
  onNavigateToLiveMode: (eventId: string) => void;
  onNavigateToSummary: (eventId: string) => void;
}

/* Same look as the organizer dashboard: standard Tailwind + a few hex colours, no config changes. */
const BRAND_ACCENT = 'brand-gradient text-white hover:brightness-110';
const field =
  'w-full rounded-xl border border-stone-200 bg-[#f4f7f6] px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-400 focus:bg-white focus:outline-none';
const btnBrand = `inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${BRAND_ACCENT}`;
const btnSoft =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-[#f0f3f2] px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-[#e6ebe9] disabled:opacity-50';
const panel = 'rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(20,30,25,0.04)]';
const th = 'py-3 pr-4 font-medium';
const dangerBtn =
  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50';

type Tab = 'overview' | 'users' | 'events' | 'registrations';

const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'overview', label: 'Overview', icon: <LayoutDashboard size={17} /> },
  { key: 'users', label: 'Sign-ups', icon: <Users size={17} /> },
  { key: 'events', label: 'Events', icon: <Calendar size={17} /> },
  { key: 'registrations', label: 'Registrations', icon: <Ticket size={17} /> },
];

const eventStatusPill = (status: string) => {
  const map: Record<string, string> = {
    LIVE: 'bg-emerald-100 text-emerald-800',
    UPCOMING: 'bg-sky-100 text-sky-800',
    ENDED: 'bg-stone-100 text-stone-600',
    DRAFT: 'bg-amber-100 text-amber-800',
  };
  const label: Record<string, string> = { LIVE: 'Live', UPCOMING: 'Upcoming', ENDED: 'Ended', DRAFT: 'Draft' };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${map[status] || map.DRAFT}`}>
      {label[status] || status}
    </span>
  );
};

const rolePill = (role: string) => (
  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${role === 'superadmin' ? 'bg-amber-100 text-amber-800' : 'bg-stone-100 text-stone-600'}`}>
    {role === 'superadmin' ? 'Super admin' : role}
  </span>
);

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({
  onBackToDashboard,
  onNavigateToLiveMode,
  onNavigateToSummary,
}) => {
  const { organizer } = useAuth();

  // ── Unlock state ──
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // ── Data ──
  const [overviewData, setOverviewData] = useState<any>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);

  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  const [events, setEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [eventSearch, setEventSearch] = useState('');
  const [eventStatusFilter, setEventStatusFilter] = useState('ALL');
  const [eventOrganizerFilter] = useState('');

  const [registrations, setRegistrations] = useState<any[]>([]);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);
  const [regSearch, setRegSearch] = useState('');
  const [regStatusFilter, setRegStatusFilter] = useState('ALL');
  const [regEventFilter] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'user' | 'event' | 'registration';
    id: string;
    name: string;
    extraInfo?: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4500);
  };

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await api.getSuperAdminStatus();
        if (res.unlocked) setIsUnlocked(true);
      } catch {
        setIsUnlocked(false);
      } finally {
        setCheckingStatus(false);
      }
    };
    checkStatus();
  }, []);

  const handleRequestOtp = async () => {
    setVerifying(true);
    setOtpError(null);
    try {
      await api.requestSuperAdminOtp();
      setOtpSent(true);
      showToast('OTP sent to the configured Super Admin email.');
    } catch (err: any) {
      setOtpError(err.message || 'Could not send the Super Admin OTP.');
    } finally {
      setVerifying(false);
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) {
      setOtpError('Enter the OTP sent to the Super Admin email.');
      return;
    }
    setVerifying(true);
    setOtpError(null);
    try {
      const res = await api.verifySuperAdminOtp(otp.trim());
      if (res.success) {
        setIsUnlocked(true);
        setOtp('');
        showToast('Unlocked.');
      } else {
        setOtpError('That OTP is incorrect.');
      }
    } catch (err: any) {
      setOtpError(err.message || 'Could not verify the OTP.');
    } finally {
      setVerifying(false);
    }
  };

  const handleLock = () => {
    api.lockSuperAdmin();
    setIsUnlocked(false);
    showToast('Session locked.');
  };

  const fetchOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      setOverviewData(await api.getSuperAdminOverview());
    } catch (err: any) {
      showToast(err.message || 'Could not load the overview', 'error');
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await api.getSuperAdminUsers(userSearch);
      setUsers(res.users);
    } catch (err: any) {
      showToast(err.message || 'Could not load users', 'error');
    } finally {
      setLoadingUsers(false);
    }
  }, [userSearch]);

  const fetchEvents = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const res = await api.getSuperAdminEvents({
        query: eventSearch,
        status: eventStatusFilter !== 'ALL' ? eventStatusFilter : undefined,
        organizerId: eventOrganizerFilter || undefined,
      });
      setEvents(res.events);
    } catch (err: any) {
      showToast(err.message || 'Could not load events', 'error');
    } finally {
      setLoadingEvents(false);
    }
  }, [eventSearch, eventStatusFilter, eventOrganizerFilter]);

  const fetchRegistrations = useCallback(async () => {
    setLoadingRegistrations(true);
    try {
      const res = await api.getSuperAdminRegistrations({
        query: regSearch,
        status: regStatusFilter !== 'ALL' ? regStatusFilter : undefined,
        eventId: regEventFilter || undefined,
      });
      setRegistrations(res.registrations);
    } catch (err: any) {
      showToast(err.message || 'Could not load registrations', 'error');
    } finally {
      setLoadingRegistrations(false);
    }
  }, [regSearch, regStatusFilter, regEventFilter]);

  useEffect(() => {
    if (!isUnlocked) return;
    if (activeTab === 'overview') fetchOverview();
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'events') fetchEvents();
    if (activeTab === 'registrations') fetchRegistrations();
  }, [isUnlocked, activeTab, fetchOverview, fetchUsers, fetchEvents, fetchRegistrations]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === 'user') {
        const res = await api.deleteSuperAdminUser(deleteTarget.id);
        showToast(res.message);
        fetchUsers();
      } else if (deleteTarget.type === 'event') {
        const res = await api.deleteSuperAdminEvent(deleteTarget.id);
        showToast(res.message);
        fetchEvents();
      } else {
        const res = await api.deleteSuperAdminRegistration(deleteTarget.id);
        showToast(res.message);
        fetchRegistrations();
      }
      if (activeTab === 'overview') fetchOverview();
      setDeleteTarget(null);
    } catch (err: any) {
      showToast(err.message || 'Delete failed', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = (type: 'users' | 'events' | 'registrations') => {
    const token =
      sessionStorage.getItem('gatekeeper_superadmin_token') ||
      localStorage.getItem('gatekeeper_superadmin_token') ||
      '';
    fetch(`/api/super-admin/export/${type}`, {
      headers: { 'x-super-admin-token': token },
      credentials: 'include',
    })
      .then((res) => {
        if (!res.ok) throw new Error('Export failed');
        return res.blob();
      })
      .then((blob) => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `gatekeeper_superadmin_${type}_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        showToast(`Exported ${type} as CSV.`);
      })
      .catch((err) => showToast(err.message || 'Export failed', 'error'));
  };

  const refreshCurrent = () => {
    if (activeTab === 'overview') fetchOverview();
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'events') fetchEvents();
    if (activeTab === 'registrations') fetchRegistrations();
  };

  const toast = toastMessage && (
    <div
      role="status"
      className={`fixed right-4 top-4 z-50 flex max-w-sm items-center gap-2.5 rounded-xl px-4 py-3 text-sm shadow-lg ${
        toastMessage.type === 'error' ? 'bg-red-700 text-white' : 'bg-stone-900 text-white'
      }`}
    >
      {toastMessage.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
      {toastMessage.text}
    </div>
  );

  // ── Checking ──
  if (checkingStatus) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#e4e8e7] text-stone-900">
        <div className="flex items-center gap-3 text-sm text-stone-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-stone-400 border-t-transparent" />
          Checking access…
        </div>
      </div>
    );
  }

  // ── Locked ──
  if (!isUnlocked) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#e4e8e7] p-4 text-stone-900">
        {toast}
        <div className="w-full max-w-sm">
          <button onClick={onBackToDashboard} className="mb-4 flex items-center gap-2 text-sm text-stone-600 hover:text-stone-900">
            <ArrowLeft size={15} /> Back to dashboard
          </button>
          <div className="rounded-3xl bg-white p-7 shadow-[0_1px_2px_rgba(20,30,25,0.06)]">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl brand-gradient">
              <Lock size={20} />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Super admin</h1>
            <p className="mt-1 text-sm text-stone-500">
              This area covers every organizer, event and registration on the platform. Verify the OTP sent to the configured Super Admin email to continue.
            </p>
            {!otpSent && (
              <button type="button" onClick={handleRequestOtp} disabled={verifying} className={`${btnBrand} mt-6 w-full`}>
                <Unlock size={15} /> {verifying ? 'Sending…' : 'Send OTP'}
              </button>
            )}
            <form onSubmit={handleUnlock} className="mt-6 space-y-4">
              {otpSent && <label className="block text-sm">
                <span className="mb-1 block font-medium">One-time password</span>
                <input type="text" inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} autoFocus className={`${field} font-mono tracking-[0.35em]`} />
              </label>}
              {otpError && (
                <p className="flex items-center gap-1.5 text-sm text-red-700">
                  <XCircle size={14} className="shrink-0" /> {otpError}
                </p>
              )}
              {otpSent && <><button type="submit" disabled={verifying} className={`${btnBrand} w-full`}>
                <Unlock size={15} /> {verifying ? 'Checking…' : 'Verify OTP'}
              </button><button type="button" onClick={handleRequestOtp} disabled={verifying} className="w-full text-sm text-stone-500 hover:text-stone-900">Send a new code</button></>}
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ── Unlocked ──
  const m = overviewData?.metrics;
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const activeLabel = tabs.find((t) => t.key === activeTab)?.label;

  const navItem = (active: boolean) =>
    `flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${active ? BRAND_ACCENT : 'text-stone-600 hover:bg-[#f0f3f2]'}`;

  const filterBar = (children: React.ReactNode, exportType: 'users' | 'events' | 'registrations') => (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-2 sm:flex-row">{children}</div>
      <button onClick={() => handleExport(exportType)} className={btnSoft}>
        <FileSpreadsheet size={15} /> Export CSV
      </button>
    </div>
  );

  const searchBox = (value: string, set: (v: string) => void, placeholder: string) => (
    <div className="relative sm:w-72">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
      <input type="text" placeholder={placeholder} value={value} onChange={(e) => set(e.target.value)} className={`${field} pl-9`} />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#e4e8e7] p-0 text-stone-900 lg:p-6">
      {toast}
      <div className="mx-auto flex min-h-screen max-w-[1440px] overflow-hidden bg-[#f1f5f4] lg:min-h-[calc(100vh-3rem)] lg:rounded-[28px]">
        {/* Sidebar */}
        <aside className="hidden w-60 shrink-0 flex-col bg-white/60 px-4 py-6 lg:flex">
          <div className="mb-8 px-2">
            <div className="flex items-center gap-2.5">
              <BrandLogo className="h-8 w-8 rounded-lg" />
              <span className="text-lg font-bold tracking-tight">GateKeeper</span>
            </div>
            <span className="mt-2 inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">Super admin</span>
          </div>
          <nav className="space-y-1">
            {tabs.map((t) => (
              <button key={t.key} onClick={() => setActiveTab(t.key)} className={navItem(activeTab === t.key)}>
                {t.icon} {t.label}
              </button>
            ))}
          </nav>
          <div className="mt-auto space-y-1 pt-6">
            <button onClick={onBackToDashboard} className={navItem(false)}><ArrowLeft size={17} /> Organizer dashboard</button>
            <button onClick={handleLock} className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-50">
              <Lock size={17} /> Lock session
            </button>
            {organizer?.name && <p className="truncate px-3.5 pt-3 text-xs text-stone-500">Signed in as {organizer.name}</p>}
          </div>
        </aside>

        {/* Main */}
        <div className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:py-7">
          {/* Mobile bar */}
          <div className="mb-5 flex items-center justify-between lg:hidden">
            <span className="text-lg font-bold tracking-tight">GateKeeper <span className="text-sm font-medium text-amber-700">· Super admin</span></span>
            <div className="flex items-center gap-3 text-sm text-stone-600">
              <button onClick={onBackToDashboard}>Back</button>
              <button onClick={handleLock} className="text-red-700">Lock</button>
            </div>
          </div>
          <div className="-mx-1 mb-5 flex gap-1 overflow-x-auto px-1 lg:hidden">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`shrink-0 rounded-xl px-3.5 py-2 text-sm font-medium ${activeTab === t.key ? BRAND_ACCENT : 'bg-white text-stone-600'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <header className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{activeLabel}</h1>
              <p className="mt-0.5 text-sm text-stone-500">{today}</p>
            </div>
            <button onClick={refreshCurrent} className={btnSoft} aria-label="Refresh">
              <RefreshCw size={15} /> <span className="hidden sm:inline">Refresh</span>
            </button>
          </header>

          {/* Pastel stats */}
          {m && (
            <div className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
              <div className="rounded-2xl bg-[#dcd7fb] p-5">
                <p className="text-xs font-medium text-stone-700">Organizers</p>
                <p className="mt-3 text-3xl font-bold tabular-nums">{m.totalOrganizers}</p>
                <p className="mt-1 text-xs text-stone-600">Signed up on the platform</p>
              </div>
              <div className="rounded-2xl bg-[#c3dcfb] p-5">
                <p className="text-xs font-medium text-stone-700">Events</p>
                <p className="mt-3 flex items-center gap-2 text-3xl font-bold tabular-nums">
                  {m.totalEvents}
                  {m.eventsByStatus?.LIVE > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-xs font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {m.eventsByStatus.LIVE} live
                    </span>
                  )}
                </p>
                <p className="mt-1 text-xs text-stone-600">{m.eventsByStatus?.UPCOMING} upcoming · {m.eventsByStatus?.DRAFT} draft</p>
              </div>
              <div className="rounded-2xl bg-[#b0e9c9] p-5">
                <p className="text-xs font-medium text-stone-700">Registrations</p>
                <p className="mt-3 text-3xl font-bold tabular-nums">{m.totalAttendees}</p>
                <p className="mt-1 text-xs text-stone-600">Across all events</p>
              </div>
              <div className="rounded-2xl bg-[#f6e7a8] p-5">
                <p className="text-xs font-medium text-stone-700">Checked in</p>
                <p className="mt-3 text-3xl font-bold tabular-nums">
                  {m.totalCheckedIn}
                  <span className="ml-2 text-base font-medium text-stone-600">{m.overallCheckInRate}%</span>
                </p>
                <p className="mt-1 text-xs text-stone-600">Admitted across all events</p>
              </div>
            </div>
          )}

          <div className="mt-5 space-y-5">
            {/* OVERVIEW */}
            {activeTab === 'overview' && (
              <>
                {loadingOverview && !overviewData && (
                  <div className="flex items-center justify-center gap-2 py-16 text-sm text-stone-500">
                    <RefreshCw size={15} className="animate-spin" /> Loading…
                  </div>
                )}
                {overviewData && (
                  <>
                    <div className="grid gap-5 lg:grid-cols-2">
                      <div className={panel}>
                        <div className="flex items-center justify-between">
                          <h2 className="font-semibold">Recent sign-ups</h2>
                          <button onClick={() => setActiveTab('users')} className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900">
                            View all <ChevronRight size={14} />
                          </button>
                        </div>
                        <div className="mt-4 space-y-2">
                          {overviewData.recentSignups.length === 0 && <p className="py-6 text-center text-sm text-stone-500">No sign-ups yet.</p>}
                          {overviewData.recentSignups.map((user: any) => (
                            <div key={user.id} className="flex items-center justify-between gap-3 rounded-xl bg-[#f4f7f6] px-4 py-3">
                              <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#dcd7fb] text-xs font-bold text-stone-700">
                                  {(user.name || '?').slice(0, 2).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-medium">{user.name}</div>
                                  <div className="truncate text-xs text-stone-500">{user.email}</div>
                                </div>
                              </div>
                              <div className="shrink-0 text-right">
                                {rolePill(user.role)}
                                <div className="mt-1 text-xs text-stone-400">{new Date(user.createdAt).toLocaleDateString()}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className={panel}>
                        <div className="flex items-center justify-between">
                          <h2 className="font-semibold">Recent events</h2>
                          <button onClick={() => setActiveTab('events')} className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900">
                            View all <ChevronRight size={14} />
                          </button>
                        </div>
                        <div className="mt-4 space-y-2">
                          {overviewData.recentEvents.length === 0 && <p className="py-6 text-center text-sm text-stone-500">No events yet.</p>}
                          {overviewData.recentEvents.map((evt: any) => (
                            <div key={evt.id} className="flex items-center justify-between gap-3 rounded-xl bg-[#f4f7f6] px-4 py-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium">{evt.name}</div>
                                <div className="truncate text-xs text-stone-500">{evt.venue} · {evt.date}</div>
                              </div>
                              <div className="flex shrink-0 items-center gap-3">
                                <div className="text-right">
                                  <div className="text-sm font-semibold tabular-nums">{evt.registeredCount}/{evt.capacity}</div>
                                  <div className="text-xs text-stone-400">registered</div>
                                </div>
                                <button
                                  onClick={() => onNavigateToLiveMode(evt.id)}
                                  title="Open scanner"
                                  aria-label="Open scanner"
                                  className="rounded-lg bg-white p-2 text-stone-600 transition hover:brightness-110 hover:text-stone-900"
                                >
                                  <Radio size={15} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="relative overflow-hidden rounded-2xl bg-[#1f8f8a] p-5 text-white">
                      <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10" />
                      <div className="pointer-events-none absolute -bottom-10 right-16 h-24 w-24 rounded-full bg-white/10" />
                      <div className="relative flex min-w-0 items-start gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
                          <Database size={20} />
                        </div>
                        <div className="min-w-0">
                          <h2 className="font-semibold">Storage: {m.storageEngine}</h2>
                          <p className="break-words text-sm text-white/80">All data is saved to this store, with an in-memory copy for speed.</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {/* SIGN-UPS */}
            {activeTab === 'users' && (
              <div className={panel}>
                {filterBar(searchBox(userSearch, setUserSearch, 'Search name or email'), 'users')}
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-stone-200 text-xs text-stone-400">
                        <th className={th}>User</th>
                        <th className={th}>Role</th>
                        <th className={`${th} hidden sm:table-cell`}>Signed up</th>
                        <th className={`${th} text-center`}>Events</th>
                        <th className={`${th} hidden text-center sm:table-cell`}>Guests</th>
                        <th className="py-3 text-right font-medium"><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {loadingUsers ? (
                        <tr><td colSpan={6} className="py-12 text-center text-stone-400">Loading…</td></tr>
                      ) : users.length === 0 ? (
                        <tr><td colSpan={6} className="py-12 text-center text-stone-500">No users match.</td></tr>
                      ) : (
                        users.map((u) => (
                          <tr key={u.id} className="hover:bg-[#f7faf9]">
                            <td className="py-3 pr-4">
                              <div className="flex items-center gap-3">
                                <div className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#dcd7fb] text-xs font-bold text-stone-700 sm:flex">
                                  {(u.name || '?').slice(0, 2).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="truncate font-medium">{u.name}</div>
                                  <div className="truncate text-xs text-stone-500">{u.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 pr-4">{rolePill(u.role)}</td>
                            <td className="hidden py-3 pr-4 text-stone-500 sm:table-cell">{new Date(u.createdAt).toLocaleDateString()}</td>
                            <td className="py-3 pr-4 text-center font-medium tabular-nums">{u.eventsCount}</td>
                            <td className="hidden py-3 pr-4 text-center tabular-nums text-stone-600 sm:table-cell">{u.attendeesCount}</td>
                            <td className="py-3 text-right">
                              {u.isCurrentSuperAdmin ? (
                                <span className="text-xs text-stone-400">You</span>
                              ) : (
                                <button
                                  onClick={() =>
                                    setDeleteTarget({
                                      type: 'user',
                                      id: u.id,
                                      name: u.name,
                                      extraInfo: `This permanently deletes the account, along with ${u.eventsCount} event${u.eventsCount === 1 ? '' : 's'} and ${u.attendeesCount} guest registration${u.attendeesCount === 1 ? '' : 's'}.`,
                                    })
                                  }
                                  className={dangerBtn}
                                >
                                  <Trash2 size={14} /> Delete
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* EVENTS */}
            {activeTab === 'events' && (
              <div className={panel}>
                {filterBar(
                  <>
                    {searchBox(eventSearch, setEventSearch, 'Search event, venue or organizer')}
                    <select value={eventStatusFilter} onChange={(e) => setEventStatusFilter(e.target.value)} className={`${field} sm:w-40`} aria-label="Filter by status">
                      <option value="ALL">All statuses</option>
                      <option value="LIVE">Live</option>
                      <option value="UPCOMING">Upcoming</option>
                      <option value="DRAFT">Draft</option>
                      <option value="ENDED">Ended</option>
                    </select>
                  </>,
                  'events'
                )}
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-stone-200 text-xs text-stone-400">
                        <th className={th}>Event</th>
                        <th className={`${th} hidden md:table-cell`}>Organizer</th>
                        <th className={`${th} hidden sm:table-cell`}>When and where</th>
                        <th className={th}>Status</th>
                        <th className={`${th} text-center`}>Registered</th>
                        <th className="py-3 text-right font-medium"><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {loadingEvents ? (
                        <tr><td colSpan={6} className="py-12 text-center text-stone-400">Loading…</td></tr>
                      ) : events.length === 0 ? (
                        <tr><td colSpan={6} className="py-12 text-center text-stone-500">No events match.</td></tr>
                      ) : (
                        events.map((e) => (
                          <tr key={e.id} className="hover:bg-[#f7faf9]">
                            <td className="py-3 pr-4">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{e.name}</span>
                                <span className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[10px] text-stone-500">{e.prefix}</span>
                              </div>
                              <div className="line-clamp-1 text-xs text-stone-500">{e.description || 'No description'}</div>
                            </td>
                            <td className="hidden py-3 pr-4 md:table-cell">
                              <div className="font-medium">{e.organizer.name}</div>
                              <div className="text-xs text-stone-500">{e.organizer.email}</div>
                            </td>
                            <td className="hidden py-3 pr-4 sm:table-cell">
                              <div>{e.date} · {e.startTime}</div>
                              <div className="text-xs text-stone-500">{e.venue}</div>
                            </td>
                            <td className="py-3 pr-4">{eventStatusPill(e.status)}</td>
                            <td className="py-3 pr-4 text-center">
                              <div className="font-semibold tabular-nums">{e.registeredCount} / {e.capacity}</div>
                              <div className="text-xs text-stone-500">{e.checkedInCount} in</div>
                            </td>
                            <td className="py-3">
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => onNavigateToLiveMode(e.id)} title="Open scanner" aria-label="Open scanner" className="rounded-lg p-2 text-stone-500 hover:bg-[#f0f3f2] hover:text-stone-900"><Radio size={15} /></button>
                                <button onClick={() => onNavigateToSummary(e.id)} title="View summary" aria-label="View summary" className="rounded-lg p-2 text-stone-500 hover:bg-[#f0f3f2] hover:text-stone-900"><ExternalLink size={15} /></button>
                                <button
                                  onClick={() =>
                                    setDeleteTarget({
                                      type: 'event',
                                      id: e.id,
                                      name: e.name,
                                      extraInfo: `This permanently deletes the event and all ${e.registeredCount} guest registration${e.registeredCount === 1 ? '' : 's'}.`,
                                    })
                                  }
                                  title="Delete event"
                                  aria-label="Delete event"
                                  className="rounded-lg p-2 text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* REGISTRATIONS */}
            {activeTab === 'registrations' && (
              <div className={panel}>
                {filterBar(
                  <>
                    {searchBox(regSearch, setRegSearch, 'Search name, email or ticket')}
                    <select value={regStatusFilter} onChange={(e) => setRegStatusFilter(e.target.value)} className={`${field} sm:w-44`} aria-label="Filter by check-in status">
                      <option value="ALL">Everyone</option>
                      <option value="CHECKED_IN">Checked in</option>
                      <option value="NOT_CHECKED_IN">Not arrived</option>
                    </select>
                  </>,
                  'registrations'
                )}
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-stone-200 text-xs text-stone-400">
                        <th className={th}>Guest</th>
                        <th className={`${th} hidden md:table-cell`}>Event</th>
                        <th className={`${th} hidden sm:table-cell`}>Ticket</th>
                        <th className={th}>Status</th>
                        <th className={`${th} hidden lg:table-cell`}>Registered</th>
                        <th className="py-3 text-right font-medium"><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {loadingRegistrations ? (
                        <tr><td colSpan={6} className="py-12 text-center text-stone-400">Loading…</td></tr>
                      ) : registrations.length === 0 ? (
                        <tr><td colSpan={6} className="py-12 text-center text-stone-500">No registrations match.</td></tr>
                      ) : (
                        registrations.map((r) => (
                          <tr key={r.id} className="hover:bg-[#f7faf9]">
                            <td className="py-3 pr-4">
                              <div className="font-medium">{r.name}</div>
                              <div className="text-xs text-stone-500">{r.email}</div>
                            </td>
                            <td className="hidden py-3 pr-4 md:table-cell">
                              <div className="font-medium">{r.event.name}</div>
                              <div className="text-xs text-stone-500">{r.event.venue}</div>
                            </td>
                            <td className="hidden py-3 pr-4 sm:table-cell">
                              <div className="font-mono text-xs">{r.ticketCode}</div>
                              <div className="text-xs text-stone-500">{r.ticketType}</div>
                            </td>
                            <td className="py-3 pr-4">
                              {r.checkedInAt ? (
                                <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">Checked in</span>
                              ) : (
                                <span className="inline-flex rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">Not arrived</span>
                              )}
                            </td>
                            <td className="hidden py-3 pr-4 text-xs text-stone-500 lg:table-cell">{new Date(r.registeredAt).toLocaleString()}</td>
                            <td className="py-3 text-right">
                              <button
                                onClick={() =>
                                  setDeleteTarget({
                                    type: 'registration',
                                    id: r.id,
                                    name: `${r.name} (${r.ticketCode})`,
                                    extraInfo: `This removes the guest's registration from "${r.event.name}".`,
                                  })
                                }
                                className={dangerBtn}
                              >
                                <Trash2 size={14} /> Delete
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-stone-900/50 p-4" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">Delete {deleteTarget.name}?</h3>
            {deleteTarget.extraInfo && <p className="mt-2 text-sm text-stone-600">{deleteTarget.extraInfo}</p>}
            <p className="mt-2 text-sm font-medium text-red-700">This can't be undone.</p>
            <div className="mt-6 flex justify-end gap-2">
              <button disabled={deleting} onClick={() => setDeleteTarget(null)} className={btnSoft}>Keep it</button>
              <button
                disabled={deleting}
                onClick={confirmDelete}
                className="inline-flex items-center rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;