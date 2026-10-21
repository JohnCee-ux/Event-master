import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import {
  ShieldCheckIcon,
  EyeIcon,
  EyeOffIcon,
  ArrowRightIcon,
} from '../components/icons/CustomIcons.js';

interface RegisterOrganizerProps {
  onNavigateToLogin: () => void;
  onNavigateToPublicRegister?: () => void;
}

export const RegisterOrganizer: React.FC<RegisterOrganizerProps> = ({
  onNavigateToLogin,
  onNavigateToPublicRegister,
}) => {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

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
    setLoading(true);

    try {
      await register({ name, email, password });
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-auth-page">
      <style>{`
        .register-auth-page {
          --bg: #060918;
          --card: rgba(10, 14, 36, .92);
          --border: rgba(255, 255, 255, .1);
          --text: #f8fafc;
          --muted: #94a3b8;
          --primary: #3861fb;
          --primary-contrast: #ffffff;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 16px;
          background:
            radial-gradient(ellipse 80% 60% at 50% 0%, rgba(56, 97, 251, .16), transparent 70%),
            linear-gradient(135deg, #060918 0%, #0a0e24 100%);
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
          box-shadow: 0 24px 70px rgba(0,0,0,.45), 0 0 45px rgba(56,97,251,.08);
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
        .register-auth-input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(56,97,251,.22), 0 0 22px rgba(56,97,251,.1); }
        .register-auth-input::placeholder { color: #64748b; }
        .register-auth-submit {
          height: 48px;
          background: linear-gradient(135deg, #3861fb, #6366f1);
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
            <h1 className="text-2xl font-bold tracking-tight">Create your workspace</h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>Please enter your details to get started</p>
          </header>

          <button type="button" aria-label="Continue with Google" className="h-11 w-full rounded-lg border flex items-center justify-center transition-colors hover:bg-white/5" style={{ borderColor: 'var(--border)' }}>
            <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.35 12.23c0-.79-.07-1.55-.23-2.27H12v4.3h5.22a4.47 4.47 0 0 1-1.94 2.93v2.44h3.14c1.84-1.7 2.93-4.2 2.93-7.4Z"/><path fill="#34A853" d="M12 21.5c2.63 0 4.84-.87 6.45-2.37l-3.14-2.44c-.87.58-1.98.92-3.31.92-2.54 0-4.7-1.72-5.47-4.03H3.28v2.52A9.74 9.74 0 0 0 12 21.5Z"/><path fill="#FBBC05" d="M6.53 13.58a5.85 5.85 0 0 1 0-3.16V7.9H3.28a9.75 9.75 0 0 0 0 8.2l3.25-2.52Z"/><path fill="#EA4335" d="M12 6.39c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 3.48 14.63 2.5 12 2.5a9.74 9.74 0 0 0-8.72 5.4l3.25 2.52C7.3 8.11 9.46 6.39 12 6.39Z"/></svg>
          </button>

          <div className="my-6 flex items-center gap-3 text-xs" style={{ color: 'var(--muted)' }}><span className="h-px flex-1" style={{ background: 'var(--border)' }} /><span>Or</span><span className="h-px flex-1" style={{ background: 'var(--border)' }} /></div>

          {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

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

            <div className="flex items-center justify-between py-1 text-sm">
              <label className="flex items-center gap-2" style={{ color: 'var(--muted)' }}><input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-4 w-4 rounded" /> Remember me</label>
              <button type="button" className="font-medium hover:underline" style={{ color: 'var(--primary)' }} onClick={() => setError('Password recovery is not available during registration.')}>Forgot Password?</button>
            </div>

            <label className="flex items-start gap-2 text-xs" style={{ color: 'var(--muted)' }}><input type="checkbox" checked={agreedTerms} onChange={(e) => setAgreedTerms(e.target.checked)} className="mt-0.5 h-4 w-4 rounded" /><span>I agree to operate event doors responsibly and comply with attendee data privacy guidelines.</span></label>
            <button type="submit" disabled={loading} className="register-auth-submit mt-2 flex w-full items-center justify-center gap-2 font-semibold"><span>{loading ? 'Creating Account...' : 'Create account'}</span>{loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <ArrowRightIcon size={17} />}</button>
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
