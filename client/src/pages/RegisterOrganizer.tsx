import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import {
  ShieldCheckIcon,
  EyeIcon,
  EyeOffIcon,
  ArrowRightIcon,
} from '../components/icons/CustomIcons.js';
import { BrandLogo } from '../components/BrandLogo.js';

interface RegisterOrganizerProps {
  onNavigateToLogin: () => void;
  onNavigateToPublicRegister?: () => void;
}

export const RegisterOrganizer: React.FC<RegisterOrganizerProps> = ({
  onNavigateToLogin,
  onNavigateToPublicRegister,
}) => {
  const { requestRegistrationOtp, verifyRegistrationOtp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: { name?: string; email?: string; password?: string } = {};
    if (!name.trim()) nextErrors.name = 'Organization name is required.';
    if (!email.trim()) nextErrors.email = 'Email is required.';
    else if (!/^\S+@\S+\.\S+$/.test(email)) nextErrors.email = 'Enter a valid email address.';
    if (!password) nextErrors.password = 'Password is required.';
    else if (password.length < 6) nextErrors.password = 'Password must be at least 6 characters.';
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    if (!agreedTerms) {
      setError('Please accept the event operations terms to proceed.');
      return;
    }
    setError(null);
    setNotice(null);
    setLoading(true);

    try {
      if (!otpSent) {
        await requestRegistrationOtp({ name: name.trim(), email: email.trim(), password });
        setOtpSent(true);
        setNotice('A verification code was sent to your email.');
      } else {
        if (!/^\d{6}$/.test(otp)) {
          setError('Enter the 6-digit verification code sent to your email.');
          return;
        }
        await verifyRegistrationOtp(email.trim(), otp);
      }
    } catch (err: any) {
      if (err.message?.includes('already exists')) {
        setError('An account already exists for this email. Redirecting you to login…');
        setTimeout(onNavigateToLogin, 1200);
      } else {
        setError(err.message || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-auth-page">
      <style>{`
        .register-auth-page {
          --bg: var(--c-bg);
          --card: color-mix(in srgb, var(--c-surface) 92%, transparent);
          --border: var(--c-border-hi);
          --text: var(--c-text);
          --muted: var(--c-text-2);
          --primary: var(--c-coral);
          --primary-contrast: #ffffff;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 16px;
          background:
          radial-gradient(ellipse 80% 60% at 50% 0%, var(--c-coral-glow), transparent 70%),
            linear-gradient(135deg, var(--c-bg) 0%, var(--c-surface) 100%);
          color: var(--text);
          font-family: 'Inter', sans-serif;
        }
        .register-auth-card {
          width: min(100%, 440px);
          position: relative;
          overflow: hidden;
          padding: 32px;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 24px;
          box-shadow: 0 24px 70px rgba(0,0,0,.45), 0 0 45px var(--c-coral-soft);
        }
        .register-auth-card::before {
          content: '';
          position: absolute;
          inset: 0 0 auto;
          height: 118px;
          pointer-events: none;
          opacity: .28;
          background: repeating-linear-gradient(90deg, transparent 0 13px, var(--primary) 14px 15px, transparent 16px 28px);
          mask-image: linear-gradient(to bottom, #000, transparent);
        }
        .register-auth-content { position: relative; z-index: 1; }
        .register-auth-input {
          height: 48px;
          width: 100%;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: rgba(16, 20, 46, .8);
          color: var(--text);
          outline: none;
          padding: 0 14px;
          transition: border-color .2s, box-shadow .2s;
        }
        .register-auth-input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px var(--c-coral-soft), 0 0 22px var(--c-coral-glow); }
        .register-auth-input::placeholder { color: var(--c-text-3); }
        .register-auth-submit {
          height: 48px;
          background: var(--brand-gradient);
          color: var(--primary-contrast);
          border-radius: 8px;
          transition: transform .2s, filter .2s;
        }
        .register-auth-submit:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); }
        .register-auth-submit:disabled { opacity: .6; cursor: not-allowed; }
      `}</style>
      <main className="register-auth-card">
        <div className="register-auth-content">
          <header className="mb-7 text-center">
            <BrandLogo className="mx-auto mb-4 h-14 w-14 rounded-2xl" />
            <h1 className="text-2xl font-bold tracking-tight">Create your workspace</h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>Please enter your details to get started</p>
          </header>

          {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          {notice && <div role="status" className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-700">{notice}</div>}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label htmlFor="register-name" className="mb-2 block text-sm font-medium">Organization Name <span className="text-red-500">*</span></label>
              <input id="register-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter organization name" autoComplete="organization" aria-invalid={Boolean(fieldErrors.name)} className="register-auth-input" />
              {fieldErrors.name && <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>}
            </div>
            <div>
              <label htmlFor="register-email" className="mb-2 block text-sm font-medium">E-mail Address <span className="text-red-500">*</span></label>
              <input id="register-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter Email ID" autoComplete="email" aria-invalid={Boolean(fieldErrors.email)} className="register-auth-input" />
              {fieldErrors.email && <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}
            </div>
            <div>
              <label htmlFor="register-password" className="mb-2 block text-sm font-medium">Password <span className="text-red-500">*</span></label>
              <div className="relative">
                <input id="register-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter Password" autoComplete="new-password" aria-invalid={Boolean(fieldErrors.password)} className="register-auth-input pr-12" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 p-1" style={{ color: 'var(--muted)' }}>{showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}</button>
              </div>
              {fieldErrors.password && <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>}
            </div>

            {otpSent && <div>
              <label htmlFor="register-otp" className="mb-2 block text-sm font-medium">Verification code</label>
              <input id="register-otp" type="text" inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Enter 6-digit code" className="register-auth-input font-mono tracking-[0.3em]" />
              <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>Check {email} to complete registration.</p>
            </div>}

            <div className="flex items-center py-1 text-sm">
              <label className="flex items-center gap-2" style={{ color: 'var(--muted)' }}><input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-4 w-4 rounded" /> Remember me</label>
            </div>

            <label className="flex items-start gap-2 text-xs" style={{ color: 'var(--muted)' }}><input type="checkbox" checked={agreedTerms} onChange={(e) => setAgreedTerms(e.target.checked)} className="mt-0.5 h-4 w-4 rounded" /><span>I agree to operate event doors responsibly and comply with attendee data privacy guidelines.</span></label>
            <button type="submit" disabled={loading} className="register-auth-submit mt-2 flex w-full items-center justify-center gap-2 font-semibold"><span>{loading ? (otpSent ? 'Verifying…' : 'Sending code…') : (otpSent ? 'Verify and create account' : 'Continue with email verification')}</span>{loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <ArrowRightIcon size={17} />}</button>
          </form>

          <footer className="mt-7 text-center text-sm" style={{ color: 'var(--muted)' }}>
            Already have an account? <a href="/login" onClick={(event) => { event.preventDefault(); onNavigateToLogin(); }} className="font-semibold hover:underline" style={{ color: 'var(--primary)' }}>Sign in</a>
            {onNavigateToPublicRegister && <div className="mt-3 text-xs">Attendee? <button type="button" onClick={onNavigateToPublicRegister} className="font-semibold hover:underline" style={{ color: 'var(--primary)' }}>Find your ticket</button></div>}
          </footer>
        </div>
      </main>
    </div>
  );
};