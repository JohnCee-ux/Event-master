import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Shield, ShieldAlert, ShieldCheck, Lock, Unlock, Key, Trash2, Users,
  Calendar, Ticket, Download, Search, RefreshCw, ArrowLeft, ExternalLink,
  AlertTriangle, Eye, EyeOff, CheckCircle2, XCircle, Database, ChevronRight,
  Radio, Clock, Activity, FileSpreadsheet
} from 'lucide-react';
import { api } from '../api/apiClient.js';
import { useAuth } from '../context/AuthContext.js';

interface SuperAdminDashboardProps {
  onBackToDashboard: () => void;
  onNavigateToLiveMode: (eventId: string) => void;
  onNavigateToSummary: (eventId: string) => void;
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({
  onBackToDashboard,
  onNavigateToLiveMode,
  onNavigateToSummary,
}) => {
  const { organizer } = useAuth();

  // ── Authentication & Gatekeeper State ──
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [passcodeError, setPasscodeError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  // ── Navigation Tabs ──
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'events' | 'registrations' | 'security'>('overview');

  // ── Data States ──
  const [overviewData, setOverviewData] = useState<any>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);

  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  const [events, setEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [eventSearch, setEventSearch] = useState('');
  const [eventStatusFilter, setEventStatusFilter] = useState('ALL');
  const [eventOrganizerFilter, setEventOrganizerFilter] = useState('');

  const [registrations, setRegistrations] = useState<any[]>([]);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);
  const [regSearch, setRegSearch] = useState('');
  const [regStatusFilter, setRegStatusFilter] = useState('ALL');
  const [regEventFilter, setRegEventFilter] = useState('');

  // ── Modals & Action States ──
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

  // ── Check if Super Admin session is already active on mount ──
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await api.getSuperAdminStatus();
        if (res.unlocked) {
          setIsUnlocked(true);
        }
      } catch {
        setIsUnlocked(false);
      } finally {
        setCheckingStatus(false);
      }
    };
    checkStatus();
  }, []);

  // ── Unlock Super Admin with unique password ──
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) {
      setPasscodeError('Please enter the Super Admin passcode.');
      return;
    }

    setVerifying(true);
    setPasscodeError(null);

    try {
      const res = await api.verifySuperAdminPasscode(passcode.trim());
      if (res.success) {
        setIsUnlocked(true);
        setPasscode('');
        showToast('Super Admin access authenticated successfully.');
      } else {
        setPasscodeError('Incorrect passcode. Super Admin access denied.');
      }
    } catch (err: any) {
      setPasscodeError(err.message || 'Passcode verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  // ── Lock Super Admin session ──
  const handleLock = () => {
    api.lockSuperAdmin();
    setIsUnlocked(false);
    showToast('Super Admin session locked securely.');
  };

  // ── Fetchers ──
  const fetchOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const data = await api.getSuperAdminOverview();
      setOverviewData(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to load metrics', 'error');
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
      showToast(err.message || 'Failed to load users', 'error');
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
      showToast(err.message || 'Failed to load events', 'error');
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
      showToast(err.message || 'Failed to load registrations', 'error');
    } finally {
      setLoadingRegistrations(false);
    }
  }, [regSearch, regStatusFilter, regEventFilter]);

  // Load data when unlocked or tab changes
  useEffect(() => {
    if (!isUnlocked) return;
    if (activeTab === 'overview') fetchOverview();
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'events') fetchEvents();
    if (activeTab === 'registrations') fetchRegistrations();
  }, [isUnlocked, activeTab, fetchOverview, fetchUsers, fetchEvents, fetchRegistrations]);

  // ── Handle Deletions ──
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      if (deleteTarget.type === 'user') {
        const res = await api.deleteSuperAdminUser(deleteTarget.id);
        showToast(res.message);
        fetchUsers();
        if (activeTab === 'overview') fetchOverview();
      } else if (deleteTarget.type === 'event') {
        const res = await api.deleteSuperAdminEvent(deleteTarget.id);
        showToast(res.message);
        fetchEvents();
        if (activeTab === 'overview') fetchOverview();
      } else if (deleteTarget.type === 'registration') {
        const res = await api.deleteSuperAdminRegistration(deleteTarget.id);
        showToast(res.message);
        fetchRegistrations();
        if (activeTab === 'overview') fetchOverview();
      }
      setDeleteTarget(null);
    } catch (err: any) {
      showToast(err.message || 'Deletion failed', 'error');
    } finally {
      setDeleting(false);
    }
  };

  // ── CSV Export ──
  const handleExport = (type: 'users' | 'events' | 'registrations') => {
    const token =
      sessionStorage.getItem('gatekeeper_superadmin_token') ||
      localStorage.getItem('gatekeeper_superadmin_token') ||
      '';

    const url = `/api/super-admin/export/${type}`;
    fetch(url, {
      headers: {
        'x-super-admin-token': token,
      },
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
        showToast(`Exported ${type} successfully as CSV.`);
      })
      .catch((err) => {
        showToast(err.message || 'Export failed', 'error');
      });
  };

  // ── Render Loading Screen ──
  if (checkingStatus) {
    return (
      <div className="min-h-screen bg-[#060918] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-slate-400 font-mono tracking-wider">Verifying Super Admin clearance...</span>
        </div>
      </div>
    );
  }

  // ── Render Unlock Passcode Modal if Locked ──
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-[#060918] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.18),rgba(255,255,255,0))] flex flex-col items-center justify-center p-4">
        {/* Toast */}
        {toastMessage && (
          <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl border shadow-2xl flex items-center gap-2.5 text-sm font-medium ${
            toastMessage.type === 'error'
              ? 'bg-rose-950/90 text-rose-200 border-rose-800'
              : 'bg-emerald-950/90 text-emerald-200 border-emerald-800'
          }`}>
            {toastMessage.type === 'error' ? <AlertTriangle className="w-4 h-4 text-rose-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            {toastMessage.text}
          </div>
        )}

        <div className="w-full max-w-md">
          {/* Back button */}
          <button
            onClick={onBackToDashboard}
            className="mb-6 flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Organizer Dashboard
          </button>

          {/* Gatekeeper Card */}
          <div className="bg-[#0c102a]/95 border border-indigo-500/30 rounded-2xl p-7 shadow-2xl backdrop-blur-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

            <div className="flex items-center gap-3.5 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-600/30 border border-indigo-500/40 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <ShieldAlert className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  Super Admin Terminal
                </h1>
                <p className="text-xs text-slate-400">Restricted elevated platform command center</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-6 bg-slate-900/60 p-3.5 rounded-xl border border-white/5">
              Super Admin grants unrestricted authority across all organizers, events, and attendee registrations. Please enter your secret master key to unlock.
            </p>

            <form onSubmit={handleUnlock} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Master Security Passcode
                </label>
                <div className="relative">
                  <input
                    type={showPasscode ? 'text' : 'password'}
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    placeholder="Enter Super Admin Password"
                    autoFocus
                    className="w-full px-4 py-3 bg-[#070b1e] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all pr-10 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasscode(!showPasscode)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  >
                    {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {passcodeError && (
                  <p className="mt-2 text-xs text-rose-400 flex items-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5 flex-shrink-0" /> {passcodeError}
                  </p>
                )}
              </div>

              <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-xl p-3 text-[11px] text-indigo-300 leading-relaxed">
                <div className="font-semibold text-indigo-200 flex items-center gap-1.5 mb-1">
                  <Key className="w-3.5 h-3.5 text-indigo-400" /> Default Passcode Info
                </div>
                Configured via <code className="bg-black/40 px-1 py-0.5 rounded text-white font-mono">SUPER_ADMIN_PASSWORD</code> in <code className="bg-black/40 px-1 py-0.5 rounded text-white font-mono">.env</code>.
                <br />
                Default password: <strong className="text-white font-mono select-all">GateKeeper#SuperAdmin2026!</strong>
              </div>

              <button
                type="submit"
                disabled={verifying}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {verifying ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verifying Clearance...</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-4 h-4" />
                    <span>Unlock Super Admin Dashboard</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ── Render Unlocked Super Admin Dashboard ──
  return (
    <div className="min-h-screen bg-[#060918] text-slate-100 flex flex-col">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl border shadow-2xl flex items-center gap-2.5 text-sm font-medium animate-slide-up ${
          toastMessage.type === 'error'
            ? 'bg-rose-950/95 text-rose-200 border-rose-800'
            : 'bg-emerald-950/95 text-emerald-200 border-emerald-800'
        }`}>
          {toastMessage.type === 'error' ? <AlertTriangle className="w-4 h-4 text-rose-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          {toastMessage.text}
        </div>
      )}

      {/* ── Top Navigation Bar ── */}
      <header className="border-b border-white/10 bg-[#090d22]/90 backdrop-blur-md sticky top-0 z-30 px-4 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 p-0.5 shadow-md shadow-indigo-500/20">
              <div className="w-full h-full bg-[#0c102a] rounded-[10px] flex items-center justify-center">
                <Shield className="w-4 h-4 text-indigo-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-base tracking-tight">GateKeeper</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/40">
                  SUPER ADMIN
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Global System Management & Oversight</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onBackToDashboard}
              className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-all flex items-center gap-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Organizer Dashboard</span>
            </button>

            <button
              onClick={handleLock}
              className="px-3.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 hover:text-rose-200 text-xs font-semibold transition-all flex items-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Lock Session</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Content Area ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6 space-y-6">

        {/* ── Global KPI Stats Bar ── */}
        {overviewData && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <div className="bg-[#0d122e] border border-white/10 rounded-2xl p-4 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Total Sign-ups</span>
                <Users className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-2xl font-black text-white font-mono">
                {overviewData.metrics.totalOrganizers}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Platform organizers/admins</div>
            </div>

            <div className="bg-[#0d122e] border border-white/10 rounded-2xl p-4 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Total Events</span>
                <Calendar className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-black text-white font-mono flex items-center gap-2">
                {overviewData.metrics.totalEvents}
                {overviewData.metrics.eventsByStatus.LIVE > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-sans font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {overviewData.metrics.eventsByStatus.LIVE} LIVE
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {overviewData.metrics.eventsByStatus.UPCOMING} upcoming · {overviewData.metrics.eventsByStatus.DRAFT} draft
              </div>
            </div>

            <div className="bg-[#0d122e] border border-white/10 rounded-2xl p-4 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Total Registers</span>
                <Ticket className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-black text-white font-mono">
                {overviewData.metrics.totalAttendees}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">All attendee registrations</div>
            </div>

            <div className="bg-[#0d122e] border border-white/10 rounded-2xl p-4 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Total Check-Ins</span>
                <Activity className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-white font-mono flex items-center gap-2">
                {overviewData.metrics.totalCheckedIn}
                <span className="text-xs text-slate-400 font-sans font-normal">
                  ({overviewData.metrics.overallCheckInRate}%)
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Verified admissions across all events
              </div>
            </div>
          </div>
        )}

        {/* ── Tabs Navigation Header ── */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'overview'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Overview</span>
            </button>

            <button
              onClick={() => setActiveTab('users')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'users'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>All Sign-Ups ({users.length > 0 ? users.length : '...'})</span>
            </button>

            <button
              onClick={() => setActiveTab('events')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'events'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>All Events ({events.length > 0 ? events.length : '...'})</span>
            </button>

            <button
              onClick={() => setActiveTab('registrations')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'registrations'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Ticket className="w-3.5 h-3.5" />
              <span>All Registrations</span>
            </button>
          </div>

          <button
            onClick={() => {
              if (activeTab === 'overview') fetchOverview();
              if (activeTab === 'users') fetchUsers();
              if (activeTab === 'events') fetchEvents();
              if (activeTab === 'registrations') fetchRegistrations();
            }}
            title="Refresh current data"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/5 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* ── TAB 1: OVERVIEW & PLATFORM STATUS ── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {loadingOverview && (
              <div className="p-8 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                Loading platform metrics...
              </div>
            )}

            {overviewData && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Sign-ups */}
                <div className="bg-[#0c102a] border border-white/10 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-white text-sm flex items-center gap-2">
                      <Users className="w-4 h-4 text-indigo-400" /> Recent User Sign-ups
                    </h3>
                    <button
                      onClick={() => setActiveTab('users')}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                    >
                      View all <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {overviewData.recentSignups.map((user: any) => (
                      <div
                        key={user.id}
                        className="p-3 rounded-xl bg-[#070b1e] border border-white/5 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-semibold text-white text-xs">{user.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{user.email}</div>
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            user.role === 'superadmin' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-white/10 text-slate-300'
                          }`}>
                            {user.role}
                          </span>
                          <div className="text-[10px] text-slate-500 mt-1">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Events Registered */}
                <div className="bg-[#0c102a] border border-white/10 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-white text-sm flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-purple-400" /> Recent Events Registered
                    </h3>
                    <button
                      onClick={() => setActiveTab('events')}
                      className="text-xs text-purple-400 hover:text-purple-300 font-medium flex items-center gap-1"
                    >
                      View all <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {overviewData.recentEvents.map((evt: any) => (
                      <div
                        key={evt.id}
                        className="p-3 rounded-xl bg-[#070b1e] border border-white/5 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-semibold text-white text-xs">{evt.name}</div>
                          <div className="text-[11px] text-slate-400">
                            {evt.venue} · {evt.date}
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-3">
                          <div className="text-right">
                            <span className="text-xs font-mono font-bold text-white">
                              {evt.registeredCount}/{evt.capacity}
                            </span>
                            <div className="text-[10px] text-slate-500">Registered</div>
                          </div>
                          <button
                            onClick={() => onNavigateToLiveMode(evt.id)}
                            title="Launch Live Mode"
                            className="p-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600 hover:text-white transition-all text-xs"
                          >
                            <Radio className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Storage Engine Status */}
                <div className="lg:col-span-2 bg-[#0c102a] border border-white/10 rounded-2xl p-5 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                      <Database className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white flex items-center gap-2">
                        Active Storage Engine: {overviewData.metrics.storageEngine}
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      </div>
                      <p className="text-xs text-slate-400">Zero data loss persistence configured with instant in-memory cache mirroring.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: ALL USERS / SIGN-UPS ── */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Filter & Export Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#0c102a] p-3.5 rounded-2xl border border-white/10">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search user name or email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[#070b1e] border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  onClick={() => handleExport('users')}
                  className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition-all"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-[#0c102a] border border-white/10 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#070b1e] text-slate-400 uppercase tracking-wider font-semibold border-b border-white/10">
                    <tr>
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Signed Up</th>
                      <th className="py-3 px-4 text-center">Events</th>
                      <th className="py-3 px-4 text-center">Attendees</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {loadingUsers ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          <RefreshCw className="w-4 h-4 animate-spin inline-block mr-2 text-indigo-400" />
                          Loading platform users...
                        </td>
                      </tr>
                    ) : users.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          No user sign-ups found matching criteria.
                        </td>
                      </tr>
                    ) : (
                      users.map((u) => (
                        <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-white">{u.name}</div>
                            <div className="text-slate-400 font-mono text-[11px]">{u.email}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              u.role === 'superadmin'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                            {new Date(u.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono font-bold text-white">
                            {u.eventsCount}
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono text-slate-300">
                            {u.attendeesCount}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {u.isCurrentSuperAdmin ? (
                              <span className="text-[10px] font-semibold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-lg">
                                Active Session
                              </span>
                            ) : (
                              <button
                                onClick={() =>
                                  setDeleteTarget({
                                    type: 'user',
                                    id: u.id,
                                    name: u.name,
                                    extraInfo: `This will permanently delete this user account along with their ${u.eventsCount} events and ${u.attendeesCount} attendee registrations.`,
                                  })
                                }
                                title="Delete User & Associated Data"
                                className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 border border-rose-500/20 transition-all font-semibold flex items-center gap-1.5 ml-auto"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete User</span>
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
          </div>
        )}

        {/* ── TAB 3: ALL EVENTS REGISTERED ── */}
        {activeTab === 'events' && (
          <div className="space-y-4">
            {/* Filter & Export Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#0c102a] p-3.5 rounded-2xl border border-white/10">
              <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search events, venue, organizer..."
                    value={eventSearch}
                    onChange={(e) => setEventSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-[#070b1e] border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <select
                  value={eventStatusFilter}
                  onChange={(e) => setEventStatusFilter(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 bg-[#070b1e] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="LIVE">Live</option>
                  <option value="UPCOMING">Upcoming</option>
                  <option value="DRAFT">Draft</option>
                  <option value="ENDED">Ended</option>
                </select>
              </div>

              <button
                onClick={() => handleExport('events')}
                className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition-all"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>Export CSV</span>
              </button>
            </div>

            {/* Events Table */}
            <div className="bg-[#0c102a] border border-white/10 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#070b1e] text-slate-400 uppercase tracking-wider font-semibold border-b border-white/10">
                    <tr>
                      <th className="py-3 px-4">Event</th>
                      <th className="py-3 px-4">Organizer</th>
                      <th className="py-3 px-4">Date & Venue</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-center">Registrations</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {loadingEvents ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          <RefreshCw className="w-4 h-4 animate-spin inline-block mr-2 text-indigo-400" />
                          Loading platform events...
                        </td>
                      </tr>
                    ) : events.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          No events registered found.
                        </td>
                      </tr>
                    ) : (
                      events.map((e) => (
                        <tr key={e.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-white flex items-center gap-2">
                              <span>{e.name}</span>
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-slate-400">
                                {e.prefix}
                              </span>
                            </div>
                            <div className="text-slate-400 text-[11px] line-clamp-1">{e.description || 'No description'}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-200">{e.organizer.name}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{e.organizer.email}</div>
                          </td>
                          <td className="py-3.5 px-4 text-[11px]">
                            <div className="text-white font-medium">{e.date} · {e.startTime}</div>
                            <div className="text-slate-400">{e.venue}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              e.status === 'LIVE'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : e.status === 'UPCOMING'
                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                                : e.status === 'ENDED'
                                ? 'bg-slate-800 text-slate-400'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            }`}>
                              {e.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono">
                            <div className="text-white font-bold">{e.registeredCount} / {e.capacity}</div>
                            <div className="text-[10px] text-slate-400">{e.checkedInCount} checked in</div>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => onNavigateToLiveMode(e.id)}
                                title="Open Live Check-In"
                                className="p-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 transition-all"
                              >
                                <Radio className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onNavigateToSummary(e.id)}
                                title="View Summary"
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-all"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() =>
                                  setDeleteTarget({
                                    type: 'event',
                                    id: e.id,
                                    name: e.name,
                                    extraInfo: `This will permanently delete this event and all ${e.registeredCount} attendee registrations.`,
                                  })
                                }
                                title="Delete Event"
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
          </div>
        )}

        {/* ── TAB 4: ALL REGISTRATIONS (ATTENDEES) ── */}
        {activeTab === 'registrations' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#0c102a] p-3.5 rounded-2xl border border-white/10">
              <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search attendee, ticket code, email..."
                    value={regSearch}
                    onChange={(e) => setRegSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-[#070b1e] border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <select
                  value={regStatusFilter}
                  onChange={(e) => setRegStatusFilter(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 bg-[#070b1e] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="ALL">All Admission Status</option>
                  <option value="CHECKED_IN">Checked In</option>
                  <option value="NOT_CHECKED_IN">Pending Check-In</option>
                </select>
              </div>

              <button
                onClick={() => handleExport('registrations')}
                className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition-all"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>Export CSV</span>
              </button>
            </div>

            {/* Registrations Table */}
            <div className="bg-[#0c102a] border border-white/10 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#070b1e] text-slate-400 uppercase tracking-wider font-semibold border-b border-white/10">
                    <tr>
                      <th className="py-3 px-4">Attendee</th>
                      <th className="py-3 px-4">Event</th>
                      <th className="py-3 px-4">Ticket</th>
                      <th className="py-3 px-4">Admission</th>
                      <th className="py-3 px-4">Registered At</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {loadingRegistrations ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          <RefreshCw className="w-4 h-4 animate-spin inline-block mr-2 text-indigo-400" />
                          Loading registrations...
                        </td>
                      </tr>
                    ) : registrations.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          No attendee registrations found.
                        </td>
                      </tr>
                    ) : (
                      registrations.map((r) => (
                        <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-white">{r.name}</div>
                            <div className="text-slate-400 font-mono text-[11px]">{r.email}</div>
                          </td>
                          <td className="py-3.5 px-4 text-[11px]">
                            <div className="font-semibold text-slate-200">{r.event.name}</div>
                            <div className="text-slate-400">{r.event.venue}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-mono font-bold text-white text-xs">{r.ticketCode}</div>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-slate-300">
                              {r.ticketType}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            {r.checkedInAt ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                CHECKED IN
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                                <Clock className="w-3 h-3 text-slate-400" />
                                PENDING
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                            {new Date(r.registeredAt).toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() =>
                                setDeleteTarget({
                                  type: 'registration',
                                  id: r.id,
                                  name: `${r.name} (${r.ticketCode})`,
                                  extraInfo: `This will cancel and remove this attendee registration from event "${r.event.name}".`,
                                })
                              }
                              title="Delete Registration"
                              className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 border border-rose-500/20 transition-all font-semibold flex items-center gap-1.5 ml-auto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ── Cascade Delete Confirmation Modal ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0c102a] border border-rose-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-rose-500" />

            <div className="flex items-center gap-3.5 mb-4 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">
                  Confirm Permanent Deletion
                </h3>
                <p className="text-xs text-rose-400/90 uppercase tracking-wider font-semibold">
                  Irreversible Super Admin Action
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 mb-3 leading-relaxed">
              Are you sure you want to delete <strong className="text-white">{deleteTarget.name}</strong>?
            </p>

            {deleteTarget.extraInfo && (
              <div className="bg-rose-950/30 border border-rose-900/40 rounded-xl p-3 text-[11px] text-rose-300 mb-5 leading-relaxed">
                {deleteTarget.extraInfo}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-lg shadow-rose-600/30 flex items-center gap-2"
              >
                {deleting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;
