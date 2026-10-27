import React, { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle, ArrowRight, ArrowUpRight, BarChart3, Check, ChevronRight,
  Clock, Eye, EyeOff, Lock, Mail, RefreshCw, QrCode, ShieldCheck,
  Ticket, Users, Wifi, WifiOff, X, Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../api/apiClient.js';
import { BrandLogo } from '../components/BrandLogo.js';

interface LoginProps {
  onNavigateToRegister: () => void;
  onNavigateToLogin: () => void;
  onNavigateToPublicRegister?: () => void;
  openAuthOnLoad?: boolean;
  onCancelAuth?: () => void;
}

type AuthTab = 'otp' | 'password';

const BRAND_BUTTON = 'brand-gradient text-white hover:brightness-110';
const field =
  'w-full rounded-xl border border-stone-200 bg-[#f4f7f6] px-3.5 py-3 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-400 focus:bg-white focus:outline-none';
const btnBrand = `inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition disabled:opacity-50 ${BRAND_BUTTON}`;
const linkBtn = 'text-sm text-stone-600 hover:text-stone-900 hover:underline underline-offset-4';
const serif: React.CSSProperties = { fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif" };

// Only the animations need real CSS. Everything else is Tailwind.
const css = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,400;1,500&display=swap');
@keyframes gk-scan { 0%,100% { top: 12%; opacity: .35; } 50% { top: 82%; opacity: 1; } }
@keyframes gk-float { 0%,100% { transform: translateY(0) rotate(-8deg); } 50% { transform: translateY(-14px) rotate(-3deg); } }
@keyframes gk-pulse-dot { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .5; transform: scale(.75); } }
@keyframes gk-slide-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes gk-badge-shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
.gk-scan-line { position: absolute; left: 10%; right: 10%; height: 2px; background: linear-gradient(90deg, transparent, var(--c-coral-hi), transparent); box-shadow: 0 0 14px var(--c-coral-hi); animation: gk-scan 2s ease-in-out infinite; }
.gk-float { animation: gk-float 5s ease-in-out infinite; }
.gk-pulse-dot { animation: gk-pulse-dot 1.4s ease-in-out infinite; }
.gk-slide-in { animation: gk-slide-in .35s ease-out both; }
.gk-badge-shimmer { background: var(--brand-gradient); background-size: 200% auto; animation: gk-badge-shimmer 2.5s linear infinite; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
@media (prefers-reduced-motion: reduce) { .gk-scan-line, .gk-float, .gk-pulse-dot, .gk-slide-in, .gk-badge-shimmer { animation: none; } .gk-scan-line { top: 50%; } }
`;

export const Login: React.FC<LoginProps> = ({ onNavigateToRegister, onNavigateToLogin, onNavigateToPublicRegister, openAuthOnLoad = false, onCancelAuth }) => {
  const { login, sendOtp, loginWithOtp } = useAuth();

  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<AuthTab>('otp');

  useEffect(() => {
    if (openAuthOnLoad) setShowAuthModal(true);
  }, [openAuthOnLoad]);

  // OTP state
  const [otpEmail, setOtpEmail] = useState('');
  const [otpStep, setOtpStep] = useState<'input_email' | 'enter_code'>('input_email');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [otpCooldown, setOtpCooldown] = useState<number>(0);
  const [otpSentMessage, setOtpSentMessage] = useState<string | null>(null);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Password state
  const [passwordEmail, setPasswordEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetStep, setResetStep] = useState<'input_email' | 'enter_code'>('input_email');
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtpDigits, setResetOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [resetPassword, setResetPassword] = useState('');
  const [resetPasswordConfirmation, setResetPasswordConfirmation] = useState('');
  const [resetCooldown, setResetCooldown] = useState(0);
  const resetOtpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleCancelAuth = () => {
    setShowAuthModal(false);
    onCancelAuth?.();
  };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timer: any;
    if (otpCooldown > 0) {
      timer = setInterval(() => setOtpCooldown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [otpCooldown]);

  useEffect(() => {
    if (resetCooldown <= 0) return;
    const timer = setInterval(() => setResetCooldown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [resetCooldown]);

  const handleOtpDigitChange = (index: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);
    if (digit && index < 5) otpInputRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const newDigits = [...otpDigits];
    for (let i = 0; i < 6; i++) newDigits[i] = pasted[i] || '';
    setOtpDigits(newDigits);
    otpInputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!otpEmail) {
      setError('Enter a valid email address.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await sendOtp(otpEmail);
      setOtpStep('enter_code');
      setOtpCooldown(60);
      setOtpSentMessage(res.message);
      setTimeout(() => otpInputRefs.current[0]?.focus(), 150);
    } catch (err: any) {
      setError(err.message || 'Could not send the code.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = otpDigits.join('');
    if (code.length !== 6) {
      setError('Enter the full 6-digit code.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await loginWithOtp(otpEmail, code);
      setShowAuthModal(false);
    } catch (err: any) {
      setError(err.message || 'That code is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login({ email: passwordEmail, password });
      setShowAuthModal(false);
    } catch (err: any) {
      setError(err.message || 'Login failed. Check your email and password.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendPasswordResetOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!resetEmail) {
      setError('Enter a valid email address.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await api.sendPasswordResetOtp(resetEmail);
      setResetStep('enter_code');
      setResetCooldown(60);
      setOtpSentMessage(res.message);
      setTimeout(() => resetOtpInputRefs.current[0]?.focus(), 150);
    } catch (err: any) {
      setError(err.message || 'Could not send the reset code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetOtpDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const nextDigits = [...resetOtpDigits];
    nextDigits[index] = digit;
    setResetOtpDigits(nextDigits);
    if (digit && index < 5) resetOtpInputRefs.current[index + 1]?.focus();
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const otp = resetOtpDigits.join('');
    if (otp.length !== 6) {
      setError('Enter the full 6-digit code.');
      return;
    }
    if (resetPassword.length < 6) {
      setError('Your password needs at least 6 characters.');
      return;
    }
    if (resetPassword !== resetPasswordConfirmation) {
      setError("Those passwords don't match.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await api.resetPassword({ email: resetEmail, otp, password: resetPassword });
      setResetMode(false);
      setResetStep('input_email');
      setResetOtpDigits(['', '', '', '', '', '']);
      setResetPassword('');
      setResetPasswordConfirmation('');
      setPasswordEmail(resetEmail);
      setPassword('');
      setOtpSentMessage('Password reset. Log in with your new password.');
    } catch (err: any) {
      setError(err.message || 'Could not reset the password.');
    } finally {
      setLoading(false);
    }
  };

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  const otpBox =
    'h-14 w-full max-w-[52px] rounded-xl border border-stone-200 bg-[#f4f7f6] text-center text-xl font-bold text-stone-900 focus:border-stone-400 focus:bg-white focus:outline-none';

  const steps = [
    {
      n: '1', icon: <Users size={20} />, title: 'Create the event',
      copy: 'Add the venue, date, capacity and ticket types, then publish when you are ready for sign-ups.',
      bg: 'bg-[#dcd7fb]',
      visual: (
        <div className="mt-4 rounded-2xl border border-[#c4bdf7] bg-white p-4">
          <div className="mb-2 text-xs font-semibold text-stone-400 uppercase tracking-wider">Event details</div>
          <div className="space-y-2">
            <div className="h-2.5 w-3/4 rounded-full bg-[#dcd7fb]" />
            <div className="h-2.5 w-1/2 rounded-full bg-[#e8e5fc]" />
            <div className="mt-3 flex gap-2">
              <div className="flex-1 rounded-xl bg-[#dcd7fb] py-2 text-center text-[10px] font-bold text-indigo-700">General · 150</div>
              <div className="flex-1 rounded-xl bg-[#ede9fd] py-2 text-center text-[10px] font-bold text-indigo-500">VIP · 20</div>
            </div>
          </div>
        </div>
      ),
    },
    {
      n: '2', icon: <Ticket size={20} />, title: 'Guests get a ticket',
      copy: 'People register on a public page and receive a unique QR ticket by email. Instantly.',
      bg: 'bg-[#c3dcfb]',
      visual: (
        <div className="mt-4 rounded-2xl border border-[#aacdf8] bg-white p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#c3dcfb]">
              <QrCode size={20} className="text-blue-700" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-stone-800">Your ticket for Summit 2025</div>
              <div className="mt-0.5 text-[10px] text-stone-400">Scan at the door · VIP access</div>
              <div className="mt-1.5 flex gap-1">
                {[...Array(3)].map((_, i) => <div key={i} className="h-1 w-1 rounded-full bg-blue-400" />)}
                <div className="h-1 w-4 rounded-full bg-blue-300" />
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      n: '3', icon: <QrCode size={20} />, title: 'Scan at the door',
      copy: 'Your team scans with a phone — no app install. Each scan instantly shows: ✓ Checked in, ⚠ Already scanned, or ✗ Invalid.',
      bg: 'bg-[#b0e9c9]',
      visual: (
        <div className="mt-4 rounded-2xl border border-[#8fd4ad] bg-stone-900 p-4">
          <div className="mb-1.5 flex items-center justify-between text-[10px] text-white/50">
            <span>Gate 1 · Live</span>
            <span className="flex items-center gap-1"><span className="gk-pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />Online</span>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-[#b0e9c9] px-3 py-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white"><Check size={14} /></span>
            <div>
              <div className="text-xs font-bold">Sarah Jenkins</div>
              <div className="text-[10px] text-stone-600">VIP · Checked in just now</div>
            </div>
          </div>
          <div className="mt-1.5 flex items-center gap-2 rounded-xl bg-amber-100 px-3 py-2">
            <AlertTriangle size={12} className="shrink-0 text-amber-600" />
            <div className="text-[10px] font-medium text-amber-800">Marcus T. — Already scanned 2m ago</div>
          </div>
        </div>
      ),
    },
    {
      n: '4', icon: <BarChart3 size={20} />, title: 'See how it went',
      copy: 'Watch arrivals live, review the full audit log, and export the guest list the moment doors close.',
      bg: 'bg-[#f6e7a8]',
      visual: (
        <div className="mt-4 rounded-2xl border border-[#e8d47e] bg-white p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <div className="text-sm font-bold">128 <span className="text-xs font-normal text-stone-400">/ 200</span></div>
            <div className="text-[10px] text-stone-500">64% arrived</div>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-stone-100">
            <div className="h-full w-[64%] rounded-full bg-indigo-500" />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1 text-center text-[10px]">
            <div className="rounded-lg bg-[#f6e7a8] py-1.5"><div className="font-bold text-stone-800">128</div><div className="text-stone-500">In</div></div>
            <div className="rounded-lg bg-stone-50 py-1.5"><div className="font-bold text-stone-800">72</div><div className="text-stone-500">Pending</div></div>
            <div className="rounded-lg bg-red-50 py-1.5"><div className="font-bold text-red-600">3</div><div className="text-stone-500">Dupes</div></div>
          </div>
        </div>
      ),
    },
  ];

  // White pill with a dark arrow circle, as in the reference
  const pillCta = (label: string, onClick: () => void, small = false) => (
    <button
      onClick={onClick}
      className={`group inline-flex items-center gap-3 rounded-full bg-white pl-5 pr-1.5 font-semibold text-stone-900 transition hover:bg-[#eef1ff] ${small ? 'py-1 text-sm' : 'py-1.5 text-[15px]'}`}
    >
      {label}
      <span className={`flex items-center justify-center rounded-full bg-stone-900 text-white transition group-hover:bg-indigo-700 ${small ? 'h-7 w-7' : 'h-9 w-9'}`}>
        <ArrowUpRight size={small ? 14 : 17} />
      </span>
    </button>
  );

  // ─── Interactive Offline Widget ────────────────────────────────────────────
  const OfflineWidget: React.FC = () => {
    const [isOffline, setIsOffline] = useState(true);
    const [queue, setQueue] = useState([
      { name: 'Ada Okafor', status: 'queued' as 'queued' | 'synced' },
      { name: 'Tunde Bello', status: 'queued' as 'queued' | 'synced' },
      { name: 'Chioma Eze', status: 'synced' as 'queued' | 'synced' },
    ]);

    const handleToggle = () => {
      const goingOnline = isOffline;
      setIsOffline(!goingOnline);
      if (goingOnline) {
        // Simulate sync when coming back online
        let i = 0;
        const iv = setInterval(() => {
          setQueue(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'synced' } : r));
          i++;
          if (i >= 2) clearInterval(iv);
        }, 600);
      } else {
        setQueue(prev => prev.map((r, idx) => idx < 2 ? { ...r, status: 'queued' } : r));
      }
    };

    return (
      <div className="rounded-[32px] bg-[#eef2ff] p-6 sm:p-8">
        <div className="flex items-start justify-between">
          <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${isOffline ? 'bg-white text-indigo-700' : 'bg-emerald-100 text-emerald-700'} transition-colors duration-300`}>
            {isOffline ? <WifiOff size={20} /> : <Wifi size={20} />}
          </span>
          {/* Toggle */}
          <button
            onClick={handleToggle}
            aria-label={isOffline ? 'Simulate going online' : 'Simulate going offline'}
            className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-300 focus:outline-none ${
              isOffline ? 'bg-stone-300' : 'bg-emerald-500'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-300 ${
                isOffline ? 'translate-x-0.5' : 'translate-x-7'
              }`}
            />
          </button>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <h3 className="text-2xl font-semibold tracking-tight">
            {isOffline ? 'Scans queue locally' : 'Back online — syncing'}
          </h3>
          {!isOffline && <RefreshCw size={18} className="animate-spin text-emerald-600" />}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          {isOffline
            ? "Toggle the switch above to simulate your Wi-Fi returning. Queued scans flush automatically the moment connectivity is restored."
            : 'Scans saved during the outage are now pushing to the server. Zero entries lost, zero duplicates.'}
        </p>
        <div className="mt-5 space-y-2">
          {queue.map((r) => (
            <div key={r.name} className="gk-slide-in flex items-center justify-between rounded-xl bg-white px-4 py-3 text-sm">
              <span className="font-medium">{r.name}</span>
              <span className={`flex items-center gap-2 text-xs ${
                r.status === 'synced' ? 'text-emerald-600' : 'text-amber-600'
              }`}>
                <span className={`gk-pulse-dot h-2 w-2 rounded-full ${
                  r.status === 'synced' ? 'bg-emerald-500' : 'bg-amber-400'
                }`} />
                {r.status === 'synced' ? 'Synced ✓' : 'Queued offline'}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-right text-[11px] text-stone-400">Try toggling Wi-Fi above ↑</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white text-stone-900">
      <style>{css}</style>

      {/* ───── Hero ───── */}
      <section
        className="relative overflow-hidden px-4 pb-24 pt-4 sm:m-3 sm:rounded-[32px] sm:px-8 sm:pb-32 sm:pt-5"
        style={{ background: 'linear-gradient(to bottom, var(--c-bg) 0%, var(--c-surface) 28%, var(--c-purple) 60%, var(--c-purple-hi) 82%, #ffffff 100%)' }}
      >
        {/* Floating pill nav */}
        <header className="relative z-20 mx-auto flex max-w-3xl items-center justify-between rounded-full border border-white/10 bg-white/10 py-2 pl-3 pr-2 backdrop-blur-md">
          <button onClick={() => window.scrollTo(0, 0)} className="flex items-center gap-2">
            <BrandLogo className="h-8 w-8 rounded-full" />
            <span className="text-[15px] font-semibold tracking-tight text-white">GateKeeper</span>
          </button>
          <nav className="hidden items-center gap-6 text-sm text-white/80 md:flex">
            <button className="hover:text-white" onClick={() => scrollTo('preview')}>Product</button>
            <button className="hover:text-white" onClick={() => scrollTo('features')}>Features</button>
            <button className="hover:text-white" onClick={() => scrollTo('how-it-works')}>How it works</button>
            {onNavigateToPublicRegister && <button className="hover:text-white" onClick={onNavigateToPublicRegister}>Attendee tickets</button>}
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <button className="px-2 text-sm text-white/80 hover:text-white" onClick={onNavigateToLogin}>Log in</button>
            {pillCta('Get started', onNavigateToRegister, true)}
          </div>
        </header>

        {/* Decorative: stripes + floating ticket */}
        <div
          className="pointer-events-none absolute right-0 top-[38%] hidden h-72 w-44 lg:block"
          style={{
            background: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.14) 0 22px, rgba(255,255,255,0.04) 22px 44px)',
            WebkitMaskImage: 'linear-gradient(to bottom, #000, transparent)',
            maskImage: 'linear-gradient(to bottom, #000, transparent)',
          }}
        />
        <div className="gk-float pointer-events-none absolute right-[10%] top-[52%] hidden h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-pink-400 via-orange-300 to-sky-400 text-white shadow-2xl md:flex">
          <Ticket size={34} />
        </div>

        {/* Headline */}
        <div className="relative z-10 mx-auto max-w-4xl pt-16 text-center sm:pt-24">

          {/* ── Trust badge ── */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 backdrop-blur-sm">
            <span className="flex items-center gap-1 text-xs font-semibold text-white/90">
              <ShieldCheck size={13} className="text-brand-coral" />
              Trusted by organizers for 500+ events
            </span>
          </div>

          <h1 className="text-[2.75rem] font-medium leading-[1.04] tracking-tight text-white sm:text-6xl lg:text-7xl">
            Check-in that
            <br />
            <span style={serif} className="font-normal italic">keeps up with</span> the line
          </h1>

          {/* ── Offline capability callout ── */}
          <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-2xl border border-brand-coral/40 bg-brand-coral/10 px-4 py-2">
            <Zap size={14} className="shrink-0 text-brand-coral" />
            <span className="text-sm font-semibold">
              <span className="gk-badge-shimmer">100% Offline Capable</span>
              <span className="ml-1 text-white/70 font-normal">— Zero Wi-Fi required at the door</span>
            </span>
          </div>

          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">
            Register guests, email each one a QR ticket, and scan them in at the door. When the signal drops, scans save on the phone and sync later.
          </p>

          <div className="relative mt-9 flex flex-wrap items-center justify-center gap-5">
            {/* hand-drawn arrow */}
            <svg className="absolute -left-4 top-3 hidden h-12 w-24 text-white/70 md:block" viewBox="0 0 100 50" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <path d="M4 44 C 24 40, 46 16, 88 14" />
              <path d="M80 8 L 90 14 L 82 22" />
            </svg>
            <div className="flex flex-col items-center gap-1.5">
              {pillCta('Get started', onNavigateToRegister)}
              <p className="text-[11px] text-white/50">No credit card required · First event free</p>
            </div>
            {onNavigateToPublicRegister && (
              <button
                onClick={onNavigateToPublicRegister}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white/85 backdrop-blur-sm transition hover:bg-white/20 hover:text-white"
              >
                <Ticket size={14} />
                Looking for your ticket? <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ───── Social proof / Built for ───── */}
      <section className="px-5 pb-6 pt-2 text-center sm:px-8">
        <p className="text-sm text-stone-500">Built for events like</p>
        <div className="mx-auto mt-3 flex max-w-3xl flex-wrap items-center justify-center gap-x-8 gap-y-2 text-lg font-semibold text-indigo-700/80">
          {['Conferences', 'Church programs', 'Campus events', 'Weddings', 'Concerts', 'Workshops'].map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </section>

      {/* ───── Product preview ───── */}
      <section id="preview" className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          {/* Left: stat card + phone with scanner animation */}
          <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-b from-[#dbe4ff] to-[#c7d4ff] p-6 sm:p-10">
            <div className="flex flex-col items-center justify-between gap-8 sm:flex-row sm:items-center">
              <div className="w-full max-w-[260px] rounded-2xl bg-white p-5 shadow-xl">
                <p className="text-sm text-stone-500">Checked in</p>
                <p className="mt-1 text-4xl font-bold tabular-nums">128 <span className="text-lg font-medium text-stone-400">/ 200</span></p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-stone-100">
                  <div className="h-full w-[64%] rounded-full bg-indigo-600" />
                </div>
                <p className="mt-2 text-xs text-stone-500">64% have arrived</p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="rounded-xl bg-[#f1f5f4] py-2"><p className="text-base font-bold">72</p><p className="text-stone-500">Still to come</p></div>
                  <div className="rounded-xl bg-[#f1f5f4] py-2"><p className="text-base font-bold">3</p><p className="text-stone-500">Duplicate scans</p></div>
                </div>
                {/* ── Performance metrics ── */}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 rounded-xl border border-stone-100 bg-stone-50 px-3 py-2">
                    <Zap size={13} className="shrink-0 text-indigo-500" />
                    <div>
                      <div className="text-[11px] font-bold text-stone-800">&lt; 0.5s</div>
                      <div className="text-[10px] text-stone-400">Scan speed</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-stone-100 bg-stone-50 px-3 py-2">
                    <ShieldCheck size={13} className="shrink-0 text-emerald-500" />
                    <div>
                      <div className="text-[11px] font-bold text-stone-800">Zero</div>
                      <div className="text-[10px] text-stone-400">Double-entry risk</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Phone */}
              <div className="w-56 shrink-0 rounded-[28px] bg-stone-900 p-3 shadow-2xl">
                <div className="mb-2 flex items-center justify-between px-1 text-xs text-white/70">
                  <span>Gate 3</span>
                  <span className="flex items-center gap-1"><WifiOff size={12} /> Offline</span>
                </div>
                <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-black/70">
                  <QrCode size={64} className="text-white/15" />
                  <div className="absolute left-4 top-4 h-6 w-6 rounded-tl-lg border-l-4 border-t-4 border-brand-coral" />
                  <div className="absolute right-4 top-4 h-6 w-6 rounded-tr-lg border-r-4 border-t-4 border-brand-coral" />
                  <div className="absolute bottom-4 left-4 h-6 w-6 rounded-bl-lg border-b-4 border-l-4 border-brand-coral" />
                  <div className="absolute bottom-4 right-4 h-6 w-6 rounded-br-lg border-b-4 border-r-4 border-brand-coral" />
                  <div className="gk-scan-line" />
                </div>
                <div className="mt-3 flex items-center gap-3 rounded-2xl bg-[#b0e9c9] px-3 py-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white"><Check size={16} /></span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">Sarah Jenkins</p>
                    <p className="text-xs text-stone-700">VIP · Checked in</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: interactive offline widget */}
          <OfflineWidget />
        </div>
        <p className="mt-3 text-center text-xs text-stone-400">Screens shown with example data.</p>
      </section>

      {/* ───── Features ───── */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-medium tracking-tight sm:text-5xl">
            Made for busy doors and <span style={serif} className="italic">bad signal</span>
          </h2>
          <p className="mt-4 text-stone-600">Long queues and unreliable Wi-Fi wreck most events. These are built around both.</p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {/* Scan speed */}
          <div className="rounded-3xl bg-[#dcd7fb] p-6">
            <div className="flex items-start justify-between">
              <QrCode size={22} />
              <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700">&lt; 0.5s scan</span>
            </div>
            <h3 className="mt-4 text-xl font-bold">Scan with a phone</h3>
            <p className="mt-2 text-sm text-stone-700">Open the scanner in a browser, point it at a QR code and get an answer straight away. You can also type in a ticket code manually.</p>
          </div>
          {/* Live arrivals */}
          <div className="rounded-3xl bg-[#b0e9c9] p-6">
            <div className="flex items-start justify-between">
              <BarChart3 size={22} />
              <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                <span className="gk-pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-500" />Live
              </span>
            </div>
            <h3 className="mt-4 text-xl font-bold">See arrivals as they happen</h3>
            <p className="mt-2 text-sm text-stone-700">Registered, checked in and still to arrive, all in one place while the doors are open.</p>
          </div>
          {/* Fraud-proof */}
          <div className="rounded-3xl bg-[#c3dcfb] p-6">
            <div className="flex items-start justify-between">
              <ShieldCheck size={22} />
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-700">Zero duplicates</span>
            </div>
            <h3 className="mt-4 text-xl font-bold">Tickets that can't be faked</h3>
            <p className="mt-2 text-sm text-stone-700">Each ticket is signed, so a made-up QR code won't pass. A second scan is flagged instead of admitted twice, and every action goes in the audit log.</p>
          </div>
        </div>
      </section>

      {/* ───── How it works ───── */}
      <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="max-w-2xl text-3xl font-medium tracking-tight sm:text-5xl">
          From first ticket to <span style={serif} className="italic">final headcount</span>
        </h2>
        <p className="mt-3 max-w-xl text-stone-500">Four steps. No dev setup, no hardware, no special apps.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <div key={s.n} className="rounded-3xl bg-[#f1f5f4] p-5">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${s.bg}`}>{s.icon}</div>
              <p className="mt-4 text-xs font-medium text-stone-400">Step {s.n}</p>
              <h3 className="mt-1 font-bold">{s.title}</h3>
              <p className="mt-2 text-sm text-stone-600">{s.copy}</p>
              {/* Mini illustration */}
              {s.visual}
            </div>
          ))}
        </div>
      </section>

      {/* ───── CTA ───── */}
      <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6">
        <div
          className="relative overflow-hidden rounded-[32px] px-6 py-14 text-center text-white sm:px-12"
          style={{ background: 'linear-gradient(135deg, var(--c-surface) 0%, var(--c-purple) 100%)' }}
        >
          <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-12 left-10 h-32 w-32 rounded-full bg-white/10" />
          {/* Trust badge inside CTA */}
          <div className="relative mb-4 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
            <ShieldCheck size={12} className="text-brand-coral" /> Trusted for 500+ events worldwide
          </div>
          <h2 className="relative text-3xl font-medium tracking-tight sm:text-5xl">
            Running an event <span style={serif} className="italic">soon?</span>
          </h2>
          <p className="relative mx-auto mt-3 max-w-md text-white/75">Create your event, share the sign-up link, and be ready at the door in minutes.</p>
          <div className="relative mt-7 flex flex-col items-center gap-2">
            {pillCta('Get started free', onNavigateToRegister)}
            <p className="text-[11px] text-white/45">No credit card required to start · Set up your first event free</p>
          </div>
          {/* Metrics row */}
          <div className="relative mx-auto mt-8 flex flex-wrap items-center justify-center gap-6">
            {[
              { icon: <Zap size={14} />, label: '< 0.5s scan speed' },
              { icon: <ShieldCheck size={14} />, label: 'Zero double-entry risk' },
              { icon: <WifiOff size={14} />, label: '100% offline capable' },
              { icon: <Clock size={14} />, label: 'Setup in under 5 min' },
            ].map(m => (
              <div key={m.label} className="flex items-center gap-1.5 text-xs text-white/60">
                <span className="text-brand-coral">{m.icon}</span>
                {m.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── Footer ───── */}
      <footer className="border-t border-stone-200">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
            {/* Brand */}
            <div className="max-w-xs">
              <div className="flex items-center gap-2">
                <BrandLogo className="h-8 w-8 rounded-full" />
                <span className="text-lg font-extrabold tracking-tight">GateKeeper</span>
              </div>
              <p className="mt-2 text-sm font-medium leading-relaxed text-stone-600">
                Event check-in and QR ticket scanning built for the real world — including bad Wi-Fi.
              </p>
            </div>
            {/* Links */}
            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-400">Product</p>
                <ul className="space-y-2 text-sm text-stone-600">
                  <li><button className="hover:text-stone-900 hover:underline underline-offset-4" onClick={() => scrollTo('features')}>Features</button></li>
                  <li><button className="hover:text-stone-900 hover:underline underline-offset-4" onClick={() => scrollTo('how-it-works')}>How it works</button></li>
                  <li><button className="hover:text-stone-900 hover:underline underline-offset-4" onClick={() => scrollTo('preview')}>See a demo</button></li>
                </ul>
              </div>
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-400">Account</p>
                <ul className="space-y-2 text-sm text-stone-600">
                  <li>
                    <button className="hover:text-stone-900 hover:underline underline-offset-4" onClick={onNavigateToLogin}>
                      Organizer log in
                    </button>
                  </li>
                  <li>
                    <button className="hover:text-stone-900 hover:underline underline-offset-4" onClick={onNavigateToRegister}>
                      Create account
                    </button>
                  </li>
                  {onNavigateToPublicRegister && (
                    <li>
                      <button className="hover:text-stone-900 hover:underline underline-offset-4" onClick={onNavigateToPublicRegister}>
                        Find my ticket
                      </button>
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
          <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-stone-100 pt-6 text-xs text-stone-400 sm:flex-row">
            <span>© {new Date().getFullYear()} GateKeeper. All rights reserved.</span>
            <div className="flex items-center gap-4">
              <a href="/privacy" className="hover:text-stone-600">Privacy</a>
              <a href="/terms" className="hover:text-stone-600">Terms</a>
              <button className="hover:text-stone-600" onClick={onNavigateToLogin}>Organizer Login</button>
            </div>
          </div>
        </div>
      </footer>

      {/* ───── Auth modal ───── */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4" onClick={handleCancelAuth}>
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between px-6 pb-2 pt-6">
              <div>
                <h2 className="text-xl font-bold tracking-tight">Log in</h2>
                <p className="mt-0.5 text-sm text-stone-500">Go to your organizer workspace</p>
              </div>
              <button onClick={handleCancelAuth} className="rounded-lg p-1.5 text-stone-400 hover:bg-[#f0f3f2] hover:text-stone-900" aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="px-6 pt-3">
              <div className="grid grid-cols-2 rounded-xl bg-[#f0f3f2] p-1">
                {([
                  { key: 'otp', label: 'Email code' },
                  { key: 'password', label: 'Password' },
                ] as { key: AuthTab; label: string }[]).map((t) => (
                  <button
                    key={t.key}
                    onClick={() => { setActiveTab(t.key); setResetMode(false); setError(null); }}
                    className={`rounded-lg py-2 text-sm transition ${activeTab === t.key ? 'bg-white font-semibold shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6">
              {error && (
                <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-700">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              {!error && otpSentMessage && (
                <div className="mb-4 rounded-xl bg-[#eefbc4] px-3.5 py-3 text-sm text-stone-800">{otpSentMessage}</div>
              )}

              {activeTab === 'otp' && (
                otpStep === 'input_email' ? (
                  <form onSubmit={handleSendOtp} className="space-y-4">
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium">Email</span>
                      <div className="relative">
                        <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                        <input type="email" required value={otpEmail} onChange={(e) => setOtpEmail(e.target.value)} placeholder="you@example.com" className={`${field} pl-10`} />
                      </div>
                    </label>
                    <p className="text-xs text-stone-500">We'll email you a 6-digit code. No password needed.</p>
                    <button type="submit" disabled={loading} className={`${btnBrand} w-full`}>
                      {loading ? 'Sending…' : 'Send code'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp}>
                    <p className="mb-4 text-center text-sm text-stone-600">
                      Enter the 6-digit code sent to<br /><span className="font-semibold text-stone-900">{otpEmail}</span>
                    </p>
                    <div className="mb-4 flex justify-between gap-2">
                      {otpDigits.map((digit, idx) => (
                        <input
                          key={idx}
                          ref={(el) => (otpInputRefs.current[idx] = el)}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                          onPaste={handleOtpPaste}
                          aria-label={`Digit ${idx + 1}`}
                          className={otpBox}
                        />
                      ))}
                    </div>
                    <div className="mb-4 flex items-center justify-between text-sm">
                      <button type="button" className={linkBtn} onClick={() => { setOtpStep('input_email'); setOtpDigits(['', '', '', '', '', '']); }}>
                        Change email
                      </button>
                      <button
                        type="button"
                        disabled={otpCooldown > 0 || loading}
                        onClick={() => handleSendOtp()}
                        className={otpCooldown > 0 ? 'text-stone-400' : 'font-medium text-stone-900 hover:underline'}
                      >
                        {otpCooldown > 0 ? `Resend in ${otpCooldown}s` : 'Resend code'}
                      </button>
                    </div>
                    <button type="submit" disabled={loading || otpDigits.join('').length !== 6} className={`${btnBrand} w-full`}>
                      {loading ? 'Checking…' : 'Log in'}
                    </button>
                  </form>
                )
              )}

              {activeTab === 'password' && (
                resetMode ? (
                  <div>
                    <h3 className="font-semibold">Reset your password</h3>
                    <p className="mb-4 mt-1 text-sm text-stone-500">We'll email you a code to confirm it's you.</p>
                    {resetStep === 'input_email' ? (
                      <form onSubmit={handleSendPasswordResetOtp} className="space-y-4">
                        <label className="block text-sm">
                          <span className="mb-1 block font-medium">Email</span>
                          <div className="relative">
                            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                            <input type="email" required value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} placeholder="you@example.com" className={`${field} pl-10`} />
                          </div>
                        </label>
                        <button type="submit" disabled={loading} className={`${btnBrand} w-full`}>
                          {loading ? 'Sending…' : 'Send reset code'}
                        </button>
                      </form>
                    ) : (
                      <form onSubmit={handleResetPassword} className="space-y-4">
                        <p className="text-center text-sm text-stone-600">
                          Enter the code sent to <span className="font-semibold text-stone-900">{resetEmail}</span>
                        </p>
                        <div className="flex justify-between gap-2">
                          {resetOtpDigits.map((digit, idx) => (
                            <input
                              key={idx}
                              ref={(el) => (resetOtpInputRefs.current[idx] = el)}
                              type="text"
                              inputMode="numeric"
                              maxLength={1}
                              value={digit}
                              onChange={(e) => handleResetOtpDigitChange(idx, e.target.value)}
                              aria-label={`Digit ${idx + 1}`}
                              className={otpBox}
                            />
                          ))}
                        </div>
                        <label className="block text-sm">
                          <span className="mb-1 block font-medium">New password</span>
                          <input type="password" required minLength={6} value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} className={field} />
                        </label>
                        <label className="block text-sm">
                          <span className="mb-1 block font-medium">Confirm new password</span>
                          <input type="password" required minLength={6} value={resetPasswordConfirmation} onChange={(e) => setResetPasswordConfirmation(e.target.value)} className={field} />
                        </label>
                        <div className="flex items-center justify-between text-sm">
                          <button type="button" className={linkBtn} onClick={() => { setResetStep('input_email'); setResetOtpDigits(['', '', '', '', '', '']); }}>
                            Change email
                          </button>
                          <button
                            type="button"
                            disabled={resetCooldown > 0 || loading}
                            onClick={() => handleSendPasswordResetOtp()}
                            className={resetCooldown > 0 ? 'text-stone-400' : 'font-medium text-stone-900 hover:underline'}
                          >
                            {resetCooldown > 0 ? `Resend in ${resetCooldown}s` : 'Resend code'}
                          </button>
                        </div>
                        <button type="submit" disabled={loading} className={`${btnBrand} w-full`}>
                          {loading ? 'Resetting…' : 'Reset password'}
                        </button>
                      </form>
                    )}
                    <button type="button" className={`${linkBtn} mt-4`} onClick={() => { setResetMode(false); setResetStep('input_email'); setError(null); }}>
                      Back to log in
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handlePasswordLogin} className="space-y-4">
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium">Email</span>
                      <div className="relative">
                        <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                        <input type="email" required value={passwordEmail} onChange={(e) => setPasswordEmail(e.target.value)} className={`${field} pl-10`} />
                      </div>
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium">Password</span>
                      <div className="relative">
                        <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className={`${field} pl-10 pr-10`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </label>
                    <button type="submit" disabled={loading} className={`${btnBrand} w-full`}>
                      {loading ? 'Logging in…' : 'Log in'}
                    </button>
                    <button type="button" className={linkBtn} onClick={() => { setResetMode(true); setResetEmail(passwordEmail); setError(null); }}>
                      Forgot your password?
                    </button>
                  </form>
                )
              )}
            </div>

            <div className="border-t border-stone-100 px-6 py-4 text-center text-sm text-stone-500">
              New here?{' '}
              <button className="font-semibold text-stone-900 hover:underline" onClick={() => { setShowAuthModal(false); onNavigateToRegister(); }}>
                Create an account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};