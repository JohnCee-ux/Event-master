import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../api/apiClient.js';
import {
  ShieldCheckIcon,
  AlertTriangleIcon,
  EyeIcon,
  EyeOffIcon,
  ZapIcon,
  ArrowRightIcon,
  UsersIcon,
  MailIcon,
  TicketIcon,
  QrCodeIcon,
  CheckCircleIcon,
  WifiOffIcon,
  BarChartIcon
} from '../components/icons/CustomIcons.js';

interface LoginProps {
  onNavigateToRegister: () => void;
  onNavigateToLogin: () => void;
  onNavigateToPublicRegister?: () => void;
  openAuthOnLoad?: boolean;
  onCancelAuth?: () => void;
}

type AuthTab = 'otp' | 'password';

export const Login: React.FC<LoginProps> = ({ onNavigateToRegister, onNavigateToLogin, onNavigateToPublicRegister, openAuthOnLoad = false, onCancelAuth }) => {
  const { login, sendOtp, loginWithOtp } = useAuth();

  // Navigation modal state
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<AuthTab>('otp');

  useEffect(() => {
    if (openAuthOnLoad) setShowAuthModal(true);
  }, [openAuthOnLoad]);

  // OTP State
  const [otpEmail, setOtpEmail] = useState('');
  const [otpStep, setOtpStep] = useState<'input_email' | 'enter_code'>('input_email');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [otpCooldown, setOtpCooldown] = useState<number>(0);
  const [otpSentMessage, setOtpSentMessage] = useState<string | null>(null);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Password State
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

  // Common State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Countdown timer for OTP resend
  useEffect(() => {
    let timer: any;
    if (otpCooldown > 0) {
      timer = setInterval(() => {
        setOtpCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [otpCooldown]);

  useEffect(() => {
    if (resetCooldown <= 0) return;
    const timer = setInterval(() => setResetCooldown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [resetCooldown]);

  // Handle OTP digit changes
  const handleOtpDigitChange = (index: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);

    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
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
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] || '';
    }
    setOtpDigits(newDigits);
    const nextIdx = Math.min(pasted.length, 5);
    otpInputRefs.current[nextIdx]?.focus();
  };

  // Submit Send OTP
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!otpEmail) {
      setError('Please enter a valid email address');
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
      setError(err.message || 'Failed to send OTP code.');
    } finally {
      setLoading(false);
    }
  };

  // Submit Verify OTP
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = otpDigits.join('');
    if (code.length !== 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await loginWithOtp(otpEmail, code);
      setShowAuthModal(false);
    } catch (err: any) {
      setError(err.message || 'Invalid or expired OTP code.');
    } finally {
      setLoading(false);
    }
  };

  // Password Login
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login({ email: passwordEmail, password });
      setShowAuthModal(false);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendPasswordResetOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!resetEmail) {
      setError('Please enter a valid email address');
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
      setError(err.message || 'Failed to send password reset code.');
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
      setError('Please enter the complete 6-digit verification code.');
      return;
    }
    if (resetPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (resetPassword !== resetPasswordConfirmation) {
      setError('Passwords do not match.');
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
      setOtpSentMessage('Password reset successfully. Sign in with your new password.');
    } catch (err: any) {
      setError(err.message || 'Password reset failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-root">
      {/* ── CSS-in-JS styles for this redesigned page ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&display=swap');

        .login-page-root {
          min-height: 100vh;
          background: #060918;
          color: #e2e8f0;
          font-family: 'Inter', sans-serif;
          position: relative;
          overflow-x: hidden;
        }

        /* ── Ambient Background Effects ── */
        .login-page-root::before {
          content: '';
          position: fixed;
          top: -40%;
          left: -20%;
          width: 80vw;
          height: 80vw;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(56,97,251,0.08) 0%, transparent 70%);
          pointer-events: none;
          z-index: 0;
        }
        .login-page-root::after {
          content: '';
          position: fixed;
          bottom: -30%;
          right: -15%;
          width: 60vw;
          height: 60vw;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%);
          pointer-events: none;
          z-index: 0;
        }

        /* ── Grid overlay ── */
        .grid-overlay {
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(rgba(56,97,251,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(56,97,251,0.03) 1px, transparent 1px);
          background-size: 60px 60px;
          pointer-events: none;
          z-index: 0;
          mask-image: radial-gradient(ellipse 80% 60% at 50% 40%, black 30%, transparent 100%);
          -webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 40%, black 30%, transparent 100%);
        }

        /* ── Floating Orbs ── */
        .floating-orb {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
          z-index: 1;
          filter: blur(1px);
        }
        .orb-1 {
          width: 6px; height: 6px;
          background: rgba(56,97,251,0.5);
          top: 20%; left: 15%;
          animation: floatOrb 8s ease-in-out infinite;
          box-shadow: 0 0 12px rgba(56,97,251,0.4);
        }
        .orb-2 {
          width: 4px; height: 4px;
          background: rgba(99,102,241,0.4);
          top: 60%; left: 80%;
          animation: floatOrb 11s ease-in-out infinite reverse;
          box-shadow: 0 0 8px rgba(99,102,241,0.3);
        }
        .orb-3 {
          width: 3px; height: 3px;
          background: rgba(129,140,248,0.5);
          top: 35%; right: 25%;
          animation: floatOrb 9s ease-in-out infinite 2s;
          box-shadow: 0 0 10px rgba(129,140,248,0.3);
        }
        .orb-4 {
          width: 5px; height: 5px;
          background: rgba(56,97,251,0.3);
          top: 75%; left: 35%;
          animation: floatOrb 13s ease-in-out infinite 1s;
          box-shadow: 0 0 14px rgba(56,97,251,0.25);
        }

        @keyframes floatOrb {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.6; }
          25% { transform: translate(20px, -30px) scale(1.2); opacity: 1; }
          50% { transform: translate(-15px, -50px) scale(0.8); opacity: 0.4; }
          75% { transform: translate(25px, -20px) scale(1.1); opacity: 0.8; }
        }

        /* ── Navbar ── */
        .lp-nav {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 40;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          background: rgba(6,9,24,0.7);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
        .lp-nav-inner {
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 2rem;
          height: 72px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .lp-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
        }
        .lp-logo-icon {
          width: 36px; height: 36px;
          border-radius: 10px;
          background: linear-gradient(135deg, #3861fb 0%, #6366f1 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          box-shadow: 0 0 20px rgba(56,97,251,0.25);
        }
        .lp-logo-text {
          font-weight: 800;
          font-size: 1.25rem;
          letter-spacing: -0.02em;
          color: #fff;
        }
        .lp-nav-links {
          display: flex;
          align-items: center;
          gap: 2rem;
        }
        .lp-nav-link {
          font-size: 0.875rem;
          font-weight: 500;
          color: rgba(255,255,255,0.5);
          background: none;
          border: none;
          cursor: pointer;
          transition: color 0.2s;
          letter-spacing: -0.01em;
        }
        .lp-nav-link:hover { color: #fff; }
        .lp-nav-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .lp-btn-ghost {
          font-size: 0.875rem;
          font-weight: 500;
          color: rgba(255,255,255,0.6);
          background: none;
          border: none;
          cursor: pointer;
          transition: color 0.2s;
          padding: 8px 16px;
        }
        .lp-btn-ghost:hover { color: #fff; }
        .lp-btn-outline {
          font-size: 0.875rem;
          font-weight: 600;
          color: #fff;
          background: transparent;
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 999px;
          padding: 10px 24px;
          cursor: pointer;
          transition: all 0.25s;
          letter-spacing: -0.01em;
        }
        .lp-btn-outline:hover {
          border-color: rgba(56,97,251,0.5);
          background: rgba(56,97,251,0.08);
          box-shadow: 0 0 20px rgba(56,97,251,0.15);
        }
        .lp-btn-nav-primary {
          font-size: 0.875rem;
          font-weight: 700;
          color: #07102d;
          background: #fff;
          border: 1px solid #fff;
          border-radius: 999px;
          padding: 10px 20px;
          cursor: pointer;
          transition: all 0.25s;
        }
        .lp-btn-nav-primary:hover {
          background: #dbeafe;
          border-color: #dbeafe;
          box-shadow: 0 0 24px rgba(255,255,255,0.16);
        }

        /* ── Hero ── */
        .lp-hero {
          padding-top: 124px;
          padding-bottom: 64px;
          padding-left: 2rem;
          padding-right: 2rem;
          position: relative;
          z-index: 2;
        }
        .lp-hero-inner {
          max-width: 1280px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 4rem;
        }
        .lp-hero-text {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 1.5rem;
          max-width: 650px;
          text-align: left;
          flex: 1 1 55%;
        }
        .lp-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 16px;
          border-radius: 999px;
          background: rgba(56,97,251,0.08);
          border: 1px solid rgba(56,97,251,0.2);
          font-size: 0.75rem;
          font-weight: 600;
          color: #818cf8;
          letter-spacing: 0.02em;
          width: fit-content;
        }
        .lp-badge-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #3861fb;
          animation: pulse 2s ease-in-out infinite;
          box-shadow: 0 0 8px rgba(56,97,251,0.5);
        }

        .lp-hero-title {
          font-family: 'Inter', sans-serif;
          font-size: clamp(3.25rem, 6vw, 5.5rem);
          font-weight: 900;
          color: #fff;
          line-height: 1.0;
          letter-spacing: -0.04em;
        }
        .lp-hero-title em {
          font-family: 'Playfair Display', serif;
          font-style: italic;
          font-weight: 400;
          background: linear-gradient(135deg, #818cf8 0%, #3861fb 50%, #60a5fa 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .lp-hero-sub {
          font-size: 1.125rem;
          line-height: 1.7;
          color: rgba(255,255,255,0.72);
          max-width: 520px;
          font-weight: 400;
          letter-spacing: -0.01em;
        }
        .lp-hero-cta {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }
        .lp-btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 14px 32px;
          border-radius: 999px;
          background: #fff;
          color: #060918;
          font-weight: 700;
          font-size: 0.9375rem;
          border: none;
          cursor: pointer;
          transition: all 0.25s;
          letter-spacing: -0.01em;
          box-shadow: 0 0 30px rgba(255,255,255,0.08);
        }
        .lp-btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 30px rgba(255,255,255,0.12);
        }
        .lp-btn-primary:active { transform: scale(0.98); }

        .lp-btn-secondary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 14px 28px;
          border-radius: 999px;
          background: transparent;
          color: rgba(255,255,255,0.6);
          font-weight: 500;
          font-size: 0.9375rem;
          border: 1px solid rgba(255,255,255,0.1);
          cursor: pointer;
          transition: all 0.25s;
          letter-spacing: -0.01em;
        }
        .lp-btn-secondary:hover {
          color: #fff;
          border-color: rgba(255,255,255,0.2);
          background: rgba(255,255,255,0.03);
        }

        /* ── Hero feature pills ── */
        .lp-hero-pills {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          padding-top: 0.25rem;
        }
        .lp-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.75rem;
          color: rgba(255,255,255,0.86);
          font-weight: 700;
          padding: 8px 11px;
          background: rgba(56,97,251,0.1);
          border: 1px solid rgba(129,140,248,0.28);
          border-radius: 999px;
        }
        .lp-pill-icon {
          width: 20px; height: 20px;
          border-radius: 50%;
          background: rgba(56,97,251,0.12);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #818cf8;
        }
        .lp-pill-icon svg { width: 11px; height: 11px; }

        /* ── Hero Visual (3D-like abstract shape) ── */
        .lp-hero-visual {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 410px;
          flex: 0 1 420px;
        }
        .lp-visual-glow {
          position: absolute;
          width: 400px; height: 400px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(56,97,251,0.15) 0%, transparent 70%);
          filter: blur(40px);
          animation: breathe 6s ease-in-out infinite;
        }
        @keyframes breathe {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.15); opacity: 1; }
        }

        /* Abstract glassy shape */
        .lp-glass-shape {
          position: relative;
          width: 340px;
          height: 340px;
          z-index: 2;
        }
        .lp-glass-ring {
          position: absolute;
          border-radius: 50%;
          border: 1px solid rgba(56,97,251,0.15);
          animation: ringFloat 8s ease-in-out infinite;
        }
        .lp-glass-ring-1 { inset: 0; border-color: rgba(56,97,251,0.12); animation-delay: 0s; }
        .lp-glass-ring-2 { inset: 20px; border-color: rgba(99,102,241,0.1); animation-delay: 1s; }
        .lp-glass-ring-3 { inset: 40px; border-color: rgba(129,140,248,0.08); animation-delay: 2s; }
        @keyframes ringFloat {
          0%, 100% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(5deg) scale(1.02); }
        }

        /* Phone mockup inside the visual */
        .lp-phone-mock {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 216px;
          background: rgba(10,14,36,0.9);
          border: 2px solid rgba(56,97,251,0.38);
          border-radius: 28px;
          overflow: hidden;
          box-shadow: 0 24px 70px rgba(0,0,0,0.58), 0 0 46px rgba(56,97,251,0.18);
          z-index: 3;
        }
        .lp-phone-notch {
          width: 60px; height: 4px;
          background: rgba(255,255,255,0.08);
          border-radius: 4px;
          margin: 12px auto 0;
        }
        .lp-phone-content {
          padding: 16px 14px;
        }
        .lp-phone-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }
        .lp-phone-gate {
          font-size: 0.5625rem;
          font-weight: 800;
          color: #818cf8;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }
        .lp-phone-title {
          font-size: 0.9375rem;
          font-weight: 900;
          color: #fff;
          margin-top: 2px;
        }
        .lp-phone-scanner {
          width: 100%;
          aspect-ratio: 1;
          background: rgba(0,0,0,0.5);
          border: 2px solid rgba(56,97,251,0.3);
          border-radius: 16px;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          margin-bottom: 12px;
        }
        .lp-phone-scanner::before {
          content: '';
          position: absolute;
          left: 10%; right: 10%;
          height: 2px;
          background: linear-gradient(90deg, transparent, #3861fb, transparent);
          box-shadow: 0 0 12px #3861fb;
          animation: scanline 2s ease-in-out infinite;
        }
        @keyframes scanline {
          0%, 100% { top: 15%; opacity: 0.3; }
          50% { top: 80%; opacity: 0.9; }
        }
        .lp-phone-result {
          padding: 11px 12px;
          background: rgba(16,185,129,0.12);
          border: 1px solid rgba(16,185,129,0.28);
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        .lp-phone-result-icon {
          width: 24px; height: 24px;
          border-radius: 50%;
          background: rgba(16,185,129,0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #34d399;
          flex-shrink: 0;
        }
        .lp-phone-result-name {
          font-size: 0.75rem;
          font-weight: 800;
          color: #fff;
        }
        .lp-phone-result-status {
          font-size: 0.625rem;
          font-weight: 600;
          color: #34d399;
        }

        /* ── Trusted By ── */
        .lp-trusted {
          padding: 3rem 2rem;
          border-top: 1px solid rgba(255,255,255,0.04);
          border-bottom: 1px solid rgba(255,255,255,0.04);
          background: rgba(6,9,24,0.5);
          position: relative;
          z-index: 2;
        }
        .lp-trusted-inner {
          max-width: 1280px;
          margin: 0 auto;
        }
        .lp-trusted-label {
          text-align: center;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: rgba(255,255,255,0.25);
          margin-bottom: 2rem;
        }
        .lp-trusted-logos {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 3rem;
          opacity: 0.3;
        }
        .lp-trusted-logo {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 700;
          font-size: 1.125rem;
          color: rgba(255,255,255,0.7);
        }

        /* ── Features Bento ── */
        .lp-features {
          padding: 6rem 2rem;
          position: relative;
          z-index: 2;
        }
        .lp-features-inner {
          max-width: 1280px;
          margin: 0 auto;
        }
        .lp-features-header {
          text-align: center;
          max-width: 600px;
          margin: 0 auto 4rem;
        }
        .lp-features-eyebrow {
          font-size: 0.75rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #818cf8;
          margin-bottom: 1rem;
        }
        .lp-features-title {
          font-family: 'Inter', sans-serif;
          font-size: clamp(2.5rem, 5vw, 3.5rem);
          font-weight: 900;
          color: #fff;
          letter-spacing: -0.03em;
          margin-bottom: 1rem;
          line-height: 1.15;
        }
        .lp-features-title em {
          font-family: 'Playfair Display', serif;
          font-style: italic;
          font-weight: 700;
        }
        .lp-features-sub {
          font-size: 1rem;
          font-weight: 600;
          color: rgba(255,255,255,0.68);
          line-height: 1.7;
        }
        .lp-bento {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.25rem;
        }
        @media (max-width: 768px) {
          .lp-bento { grid-template-columns: 1fr; }
        }
        .lp-bento-card {
          background: rgba(10,14,36,0.6);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 24px;
          padding: 2rem;
          position: relative;
          overflow: hidden;
          transition: border-color 0.3s, box-shadow 0.3s;
        }
        .lp-bento-card:hover {
          border-color: rgba(56,97,251,0.2);
          box-shadow: 0 0 40px rgba(56,97,251,0.06);
        }
        .lp-bento-wide { grid-column: span 2; }
        @media (max-width: 768px) {
          .lp-bento-wide { grid-column: span 1; }
        }
        .lp-bento-glow {
          position: absolute;
          top: -40px; right: -40px;
          width: 200px; height: 200px;
          border-radius: 50%;
          filter: blur(60px);
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.3s;
        }
        .lp-bento-card:hover .lp-bento-glow { opacity: 1; }
        .lp-bento-icon {
          width: 48px; height: 48px;
          border-radius: 14px;
          background: rgba(56,97,251,0.08);
          border: 1px solid rgba(56,97,251,0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 1.25rem;
          color: #818cf8;
        }
        .lp-bento-card-title {
          font-size: 1.375rem;
          font-weight: 700;
          color: #fff;
          margin-bottom: 0.5rem;
          letter-spacing: -0.02em;
        }
        .lp-bento-card-desc {
          font-size: 0.875rem;
          color: rgba(255,255,255,0.68);
          line-height: 1.6;
          margin-bottom: 1.5rem;
        }
        .lp-bento-demo {
          padding: 1rem;
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 14px;
        }

        /* ── Auth Modal ── */
        .lp-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          animation: modalFadeIn 0.25s ease-out;
        }
        @keyframes modalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .lp-modal {
          position: relative;
          width: 100%;
          max-width: 440px;
          background: rgba(10,14,36,0.95);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 32px 80px rgba(0,0,0,0.5), 0 0 60px rgba(56,97,251,0.05);
          animation: modalSlideUp 0.35s cubic-bezier(0.16,1,0.3,1);
        }
        @keyframes modalSlideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .lp-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.5rem 1.75rem;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .lp-modal-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .lp-modal-logo {
          width: 36px; height: 36px;
          border-radius: 10px;
          background: linear-gradient(135deg, #3861fb 0%, #6366f1 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
        }
        .lp-modal-title {
          font-size: 1.125rem;
          font-weight: 700;
          color: #fff;
          letter-spacing: -0.02em;
        }
        .lp-modal-subtitle {
          font-size: 0.75rem;
          color: rgba(255,255,255,0.4);
          margin-top: 1px;
        }
        .lp-modal-close {
          width: 32px; height: 32px;
          border-radius: 8px;
          background: rgba(255,255,255,0.04);
          border: none;
          color: rgba(255,255,255,0.4);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1rem;
          transition: all 0.2s;
        }
        .lp-modal-close:hover { background: rgba(255,255,255,0.08); color: #fff; }

        .lp-modal-tabs {
          display: flex;
          gap: 6px;
          padding: 6px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          background: rgba(0,0,0,0.16);
        }
        .lp-modal-tab {
          flex: 1;
          padding: 10px 12px;
          font-size: 0.8125rem;
          font-weight: 600;
          text-align: center;
          background: transparent;
          border: 1px solid transparent;
          border-radius: 10px;
          cursor: pointer;
          color: rgba(255,255,255,0.48);
          transition: all 0.2s;
          letter-spacing: -0.01em;
        }
        .lp-modal-tab:hover { color: rgba(255,255,255,0.85); }
        .lp-modal-tab-active {
          color: #fff;
          border-color: rgba(129,140,248,0.8);
          background: rgba(56,97,251,0.26);
          box-shadow: 0 4px 16px rgba(56,97,251,0.18);
        }

        .lp-modal-body {
          padding: 1.75rem;
        }
        .lp-modal-footer {
          padding: 1rem 1.75rem;
          border-top: 1px solid rgba(255,255,255,0.05);
          text-align: center;
          font-size: 0.8125rem;
          color: rgba(255,255,255,0.35);
          background: rgba(0,0,0,0.15);
        }
        .lp-modal-footer-link {
          color: #818cf8;
          background: none;
          border: none;
          cursor: pointer;
          font-weight: 700;
          font-size: 0.8125rem;
        }
        .lp-modal-footer-link:hover { text-decoration: underline; }

        /* ── Form Elements ── */
        .lp-form-group {
          margin-bottom: 1.25rem;
        }
        .lp-form-label {
          display: block;
          font-size: 0.6875rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: rgba(255,255,255,0.45);
          margin-bottom: 8px;
        }
        .lp-input-wrap {
          position: relative;
        }
        .lp-input-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(255,255,255,0.25);
          pointer-events: none;
        }
        .lp-input {
          width: 100%;
          padding: 13px 44px 13px 44px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          color: #fff;
          font-size: 0.9375rem;
          font-family: 'Inter', sans-serif;
          outline: none;
          transition: all 0.2s;
        }
        .lp-input::placeholder { color: rgba(255,255,255,0.2); }
        .lp-input:focus {
          border-color: rgba(56,97,251,0.4);
          box-shadow: 0 0 0 3px rgba(56,97,251,0.08);
          background: rgba(56,97,251,0.03);
        }

        .lp-btn-submit {
          width: 100%;
          padding: 14px;
          border-radius: 14px;
          background: linear-gradient(135deg, #3861fb 0%, #6366f1 100%);
          color: #fff;
          font-weight: 700;
          font-size: 0.9375rem;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.25s;
          box-shadow: 0 4px 20px rgba(56,97,251,0.25);
          letter-spacing: -0.01em;
        }
        .lp-btn-submit:hover {
          box-shadow: 0 8px 32px rgba(56,97,251,0.35);
          transform: translateY(-1px);
        }
        .lp-btn-submit:active { transform: scale(0.98); }
        .lp-btn-submit:disabled { opacity: 0.5; pointer-events: none; }

        .lp-error-box {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 12px 16px;
          margin-bottom: 1.25rem;
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.15);
          border-radius: 14px;
          color: #fca5a5;
          font-size: 0.8125rem;
        }

        /* OTP grid */
        .lp-otp-grid {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 1rem;
        }
        .lp-otp-input {
          width: 100%;
          max-width: 56px;
          height: 56px;
          text-align: center;
          font-size: 1.375rem;
          font-weight: 800;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          color: #fff;
          outline: none;
          font-family: 'Inter', sans-serif;
          transition: all 0.2s;
        }
        .lp-otp-input:focus {
          border-color: rgba(56,97,251,0.4);
          box-shadow: 0 0 0 3px rgba(56,97,251,0.08);
          background: rgba(56,97,251,0.03);
        }

        .lp-dev-otp {
          padding: 12px 16px;
          background: rgba(56,97,251,0.06);
          border: 1px solid rgba(56,97,251,0.15);
          border-radius: 14px;
          color: #818cf8;
          font-size: 0.8125rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1rem;
        }
        .lp-dev-otp button {
          background: none;
          border: none;
          color: #818cf8;
          font-weight: 700;
          cursor: pointer;
          font-size: 0.8125rem;
        }
        .lp-dev-otp button:hover { text-decoration: underline; }

        .lp-otp-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.8125rem;
          color: rgba(255,255,255,0.35);
          margin-bottom: 1.25rem;
        }
        .lp-otp-actions button {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 0.8125rem;
          color: rgba(255,255,255,0.35);
          transition: color 0.2s;
        }
        .lp-otp-actions button:hover { color: #fff; }
        .lp-otp-actions .lp-resend-active { color: #818cf8; }
        .lp-otp-actions .lp-resend-active:hover { text-decoration: underline; }

        .lp-toggle-pw {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: rgba(255,255,255,0.3);
          cursor: pointer;
          transition: color 0.2s;
        }
        .lp-toggle-pw:hover { color: #fff; }

        .lp-otp-sent-info {
          text-align: center;
          margin-bottom: 1.5rem;
        }
        .lp-otp-sent-info .lp-otp-sent-label {
          font-size: 0.8125rem;
          color: rgba(255,255,255,0.4);
        }
        .lp-otp-sent-info .lp-otp-sent-email {
          font-size: 0.875rem;
          font-weight: 700;
          color: #818cf8;
          margin-top: 4px;
        }

        /* ── Micro bar chart ── */
        .lp-mini-bars {
          display: flex;
          align-items: flex-end;
          gap: 4px;
          height: 80px;
          padding: 12px;
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 14px;
        }
        .lp-mini-bar {
          flex: 1;
          border-radius: 3px 3px 0 0;
          transition: height 0.3s;
        }

        /* ── Scan Verification Snippet ── */
        .lp-verify-snippet {
          padding: 14px 16px;
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 14px;
        }
        .lp-verify-snippet-label {
          font-size: 0.6875rem;
          color: rgba(255,255,255,0.3);
          margin-bottom: 8px;
        }
        .lp-verify-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }
        .lp-verify-row span {
          font-size: 0.8125rem;
          font-family: 'IBM Plex Mono', monospace;
          color: #34d399;
        }

        /* ── How it works ── */
        .lp-how {
          padding: 6rem 2rem 7rem;
          position: relative;
          z-index: 2;
          border-top: 1px solid rgba(255,255,255,0.04);
          background: radial-gradient(ellipse 70% 55% at 50% 30%, rgba(56,97,251,0.07), transparent 72%);
        }
        .lp-how-inner { max-width: 1280px; margin: 0 auto; }
        .lp-how-header { max-width: 650px; margin: 0 auto 3.5rem; text-align: center; }
        .lp-how-eyebrow { color: #a5b4fc; font-size: .75rem; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; margin-bottom: 1rem; }
        .lp-how-title { color: #fff; font-size: clamp(2.25rem, 4.5vw, 3.5rem); font-weight: 900; letter-spacing: -.04em; line-height: 1.05; margin-bottom: 1rem; }
        .lp-how-title em { color: #818cf8; font-family: 'Playfair Display', serif; font-style: italic; font-weight: 700; }
        .lp-how-sub { color: rgba(255,255,255,.58); font-size: 1rem; line-height: 1.7; font-weight: 500; }
        .lp-how-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
        .lp-how-card { position: relative; min-height: 250px; padding: 1.5rem; overflow: hidden; background: rgba(10,14,36,.68); border: 1px solid rgba(255,255,255,.07); border-radius: 20px; transition: border-color .25s, transform .25s, box-shadow .25s; }
        .lp-how-card:hover { transform: translateY(-5px); border-color: rgba(56,97,251,.35); box-shadow: 0 16px 40px rgba(0,0,0,.3), 0 0 30px rgba(56,97,251,.08); }
        .lp-how-number { color: rgba(165,180,252,.95); font-family: 'IBM Plex Mono', monospace; font-size: .7rem; font-weight: 700; letter-spacing: .12em; }
        .lp-how-icon { width: 46px; height: 46px; display: flex; align-items: center; justify-content: center; margin: 1.25rem 0; color: #a5b4fc; background: rgba(56,97,251,.1); border: 1px solid rgba(56,97,251,.22); border-radius: 14px; }
        .lp-how-card-title { color: #fff; font-size: 1.05rem; font-weight: 800; letter-spacing: -.02em; margin-bottom: .55rem; }
        .lp-how-card-copy { color: rgba(255,255,255,.7); font-size: .84rem; line-height: 1.65; }
        .lp-how-detail { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-top: 1rem; padding: 1.25rem 1.5rem; background: rgba(56,97,251,.06); border: 1px solid rgba(56,97,251,.14); border-radius: 16px; }
        .lp-how-detail-item { display: flex; align-items: flex-start; gap: .7rem; }
        .lp-how-detail-item svg { color: #818cf8; flex-shrink: 0; margin-top: 2px; }
        .lp-how-detail-item strong { display: block; color: #fff; font-size: .78rem; margin-bottom: .2rem; }
        .lp-how-detail-item span { color: rgba(255,255,255,.66); font-size: .72rem; line-height: 1.45; }

        /* ── Offline status pill ── */
        .lp-offline-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 14px;
        }
        .lp-offline-dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          background: #f59e0b;
          animation: pulse 2s ease-in-out infinite;
        }
        .lp-offline-pill span {
          font-size: 0.8125rem;
          font-family: 'IBM Plex Mono', monospace;
          color: rgba(255,255,255,0.78);
        }

        @media (max-width: 640px) {
          .lp-nav-links { display: none !important; }
          .lp-nav-inner { height: 64px; padding: 0 1rem; }
          .lp-logo { gap: 7px; }
          .lp-logo-icon { width: 30px; height: 30px; border-radius: 8px; }
          .lp-logo-icon svg { width: 15px; height: 15px; }
          .lp-logo-text { font-size: 1rem; }
          .lp-nav-actions { gap: 4px; }
          .lp-btn-ghost { font-size: 0.75rem; padding: 6px 8px; }
          .lp-btn-nav-primary { font-size: 0.75rem; padding: 8px 12px; }
          .lp-hero { padding-top: 112px; padding-bottom: 40px; }
          .lp-hero-inner { flex-direction: column; gap: 1rem; }
          .lp-hero-text { align-items: center; text-align: center; }
          .lp-hero-cta { justify-content: center; }
          .lp-hero-pills { justify-content: center; }
          .lp-hero-visual { width: 100%; min-height: 360px; transform: scale(.88); margin-top: -1rem; }
          .lp-features { padding: 3rem 1rem; }
          .lp-how { padding: 4rem 1rem 5rem; }
          .lp-how-grid, .lp-how-detail { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* ── Grid Background ── */}
      <div className="grid-overlay" />

      {/* ── Floating Orbs ── */}
      <div className="floating-orb orb-1" />
      <div className="floating-orb orb-2" />
      <div className="floating-orb orb-3" />
      <div className="floating-orb orb-4" />

      {/* ── Navbar ── */}
      <nav className="lp-nav">
        <div className="lp-nav-inner">
          <div className="lp-logo" onClick={() => window.scrollTo(0, 0)}>
            <div className="lp-logo-icon">
              <ZapIcon size={18} />
            </div>
            <span className="lp-logo-text">GateKeeper</span>
          </div>

          <div className="lp-nav-links" style={{ display: 'none' }}>
            <button className="lp-nav-link">How it Works</button>
            <button className="lp-nav-link" onClick={onNavigateToPublicRegister}>Pricing</button>
            <button className="lp-nav-link">Roadmap</button>
            <button className="lp-nav-link">Discover</button>
          </div>
          <div className="lp-nav-links">
            <button className="lp-nav-link" onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}>How it Works</button>
            <button className="lp-nav-link" onClick={onNavigateToPublicRegister}>Attendee Tickets</button>
            <button className="lp-nav-link" onClick={() => setShowAuthModal(true)}>Security</button>
          </div>

          <div className="lp-nav-actions">
            <button
              className="lp-btn-ghost"
              onClick={onNavigateToLogin}
            >
              Log in
            </button>
            <button className="lp-btn-nav-primary" onClick={onNavigateToRegister}>
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section className="lp-hero">
        <div className="lp-hero-inner">
          <div className="lp-hero-text">
            <div className="lp-badge">
              <span className="lp-badge-dot" />
              GateKeeper v2.0 is live
            </div>

            <h1 className="lp-hero-title">
              Zero Line Delays.<br />
              Even <em>Offline.</em>
            </h1>

            <p className="lp-hero-sub">
              Register attendees, issue secure QR tickets, and check people
              in at scale — even when the network drops.
            </p>

            <div className="lp-hero-cta">
              <button
                className="lp-btn-primary"
                onClick={onNavigateToRegister}
              >
                Get Started
                <ArrowRightIcon size={16} />
              </button>
            </div>

            <div className="lp-hero-pills">
              <div className="lp-pill">
                <div className="lp-pill-icon"><CheckCircleIcon size={11} /></div>
                Offline-first sync
              </div>
              <div className="lp-pill">
                <div className="lp-pill-icon"><CheckCircleIcon size={11} /></div>
                Sub-100ms scans
              </div>
              <div className="lp-pill">
                <div className="lp-pill-icon"><CheckCircleIcon size={11} /></div>
                Cryptographic tickets
              </div>
            </div>
          </div>

          {/* ── Hero Visual ── */}
          <div className="lp-hero-visual">
            <div className="lp-visual-glow" />
            <div className="lp-glass-shape">
              <div className="lp-glass-ring lp-glass-ring-1" />
              <div className="lp-glass-ring lp-glass-ring-2" />
              <div className="lp-glass-ring lp-glass-ring-3" />

              <div className="lp-phone-mock">
                <div className="lp-phone-notch" />
                <div className="lp-phone-content">
                  <div className="lp-phone-header">
                    <div>
                      <div className="lp-phone-gate">Gate 3 • Main</div>
                      <div className="lp-phone-title">Scanner</div>
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.3)' }}>
                      <WifiOffIcon size={14} />
                    </div>
                  </div>
                  <div className="lp-phone-scanner">
                    <QrCodeIcon size={64} className="text-white/10" />
                  </div>
                  <div className="lp-phone-result">
                    <div className="lp-phone-result-icon">
                      <CheckCircleIcon size={12} />
                    </div>
                    <div>
                      <div className="lp-phone-result-name">Sarah Jenkins</div>
                      <div className="lp-phone-result-status">VIP • Checked in</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trusted By ── */}
      <section className="lp-trusted">
        <div className="lp-trusted-inner">
          <p className="lp-trusted-label">Trusted by modern event organizers</p>
          <div className="lp-trusted-logos">
            <div className="lp-trusted-logo"><ZapIcon size={22} /> Acme Events</div>
            <div className="lp-trusted-logo"><ShieldCheckIcon size={22} /> SecureCon</div>
            <div className="lp-trusted-logo"><BarChartIcon size={22} /> Summit Global</div>
            <div className="lp-trusted-logo"><UsersIcon size={22} /> Festify</div>
          </div>
        </div>
      </section>

      {/* ── Features Bento ── */}
      <section className="lp-features">
        <div className="lp-features-inner">
          <div className="lp-features-header">
            <div className="lp-features-eyebrow">Why GateKeeper</div>
            <h2 className="lp-features-title">
              Unlock the Full Potential<br />of <em>Your Events</em>
            </h2>
            <p className="lp-features-sub">
              Designed from the ground up to solve the hardest problems
              in event operations: bad WiFi and long lines.
            </p>
          </div>

          <div className="lp-bento">
            {/* Card 1 — wide */}
            <div className="lp-bento-card lp-bento-wide">
              <div className="lp-bento-glow" style={{ background: 'rgba(245,158,11,0.08)' }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div className="lp-bento-icon" style={{ background: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>
                  <WifiOffIcon size={22} />
                </div>
                <div className="lp-bento-card-title">True Offline-First Sync</div>
                <div className="lp-bento-card-desc">
                  When the venue Wi-Fi drops, your lines don't stop.
                  Scans are queued locally and sync automatically when
                  the connection returns.
                </div>
                <div className="lp-offline-pill">
                  <div className="lp-offline-dot" />
                  <span>Offline mode: 24 scans queued</span>
                </div>
              </div>
            </div>

            {/* Card 2 */}
            <div className="lp-bento-card">
              <div className="lp-bento-glow" style={{ background: 'rgba(56,97,251,0.08)' }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div className="lp-bento-icon">
                  <QrCodeIcon size={22} />
                </div>
                <div className="lp-bento-card-title">Rapid Scanning</div>
                <div className="lp-bento-card-desc">
                  Built on zxing architecture for sub-100ms QR recognition.
                </div>
                <div className="lp-bento-demo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80px' }}>
                  <QrCodeIcon size={40} className="text-white/10" />
                </div>
              </div>
            </div>

            {/* Card 3 */}
            <div className="lp-bento-card">
              <div className="lp-bento-glow" style={{ background: 'rgba(16,185,129,0.08)' }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div className="lp-bento-icon" style={{ background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.15)', color: '#34d399' }}>
                  <BarChartIcon size={22} />
                </div>
                <div className="lp-bento-card-title">Live Analytics</div>
                <div className="lp-bento-card-desc">
                  Track check-ins across all gates in real-time.
                </div>
                <div className="lp-mini-bars">
                  <div className="lp-mini-bar" style={{ height: '30%', background: 'rgba(52,211,153,0.3)' }} />
                  <div className="lp-mini-bar" style={{ height: '60%', background: 'rgba(52,211,153,0.5)' }} />
                  <div className="lp-mini-bar" style={{ height: '40%', background: 'rgba(52,211,153,0.6)' }} />
                  <div className="lp-mini-bar" style={{ height: '80%', background: 'rgba(52,211,153,0.8)' }} />
                  <div className="lp-mini-bar" style={{ height: '100%', background: '#34d399' }} />
                </div>
              </div>
            </div>

            {/* Card 4 — wide */}
            <div className="lp-bento-card lp-bento-wide">
              <div className="lp-bento-glow" style={{ background: 'rgba(6,182,212,0.08)' }} />
              <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: '2rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div className="lp-bento-icon" style={{ background: 'rgba(6,182,212,0.08)', borderColor: 'rgba(6,182,212,0.15)', color: '#22d3ee' }}>
                    <ShieldCheckIcon size={22} />
                  </div>
                  <div className="lp-bento-card-title">Cryptographic Tickets</div>
                  <div className="lp-bento-card-desc" style={{ marginBottom: 0 }}>
                    HMAC signed payloads ensure tickets cannot be forged or duplicated.
                  </div>
                </div>
                <div className="lp-verify-snippet" style={{ minWidth: '200px' }}>
                  <div className="lp-verify-snippet-label">Ticket verification</div>
                  <div className="lp-verify-row">
                    <CheckCircleIcon size={14} className="text-emerald-400" />
                    <span>Signature valid</span>
                  </div>
                  <div className="lp-verify-row">
                    <CheckCircleIcon size={14} className="text-emerald-400" />
                    <span>Base32 decoded</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="lp-how">
        <div className="lp-how-inner">
          <div className="lp-how-header">
            <div className="lp-how-eyebrow">How it works</div>
            <h2 className="lp-how-title">From first ticket to final <em>report</em></h2>
            <p className="lp-how-sub">One operational flow for organizers, attendees, and every gate team working the room.</p>
          </div>

          <div className="lp-how-grid">
            <article className="lp-how-card">
              <div className="lp-how-number">01 / SET UP</div>
              <div className="lp-how-icon"><UsersIcon size={22} /></div>
              <div className="lp-how-card-title">Create the event</div>
              <div className="lp-how-card-copy">Set the venue, date, capacity, ticket types, and event prefix from the organizer workspace. Publish when registration is ready.</div>
            </article>
            <article className="lp-how-card">
              <div className="lp-how-number">02 / ISSUE</div>
              <div className="lp-how-icon"><TicketIcon size={22} /></div>
              <div className="lp-how-card-title">Issue secure tickets</div>
              <div className="lp-how-card-copy">Attendees register through the public portal and receive a unique QR ticket with a signed payload and ticket code.</div>
            </article>
            <article className="lp-how-card">
              <div className="lp-how-number">03 / SCAN</div>
              <div className="lp-how-icon"><QrCodeIcon size={22} /></div>
              <div className="lp-how-card-title">Scan every gate</div>
              <div className="lp-how-card-copy">Gate teams scan with the live ZXing-powered scanner. Each result is immediately marked valid, duplicate, invalid, or queued.</div>
            </article>
            <article className="lp-how-card">
              <div className="lp-how-number">04 / LEARN</div>
              <div className="lp-how-icon"><BarChartIcon size={22} /></div>
              <div className="lp-how-card-title">See the full picture</div>
              <div className="lp-how-card-copy">Watch attendance and gate velocity live, inspect the append-only audit trail, then export the final attendee summary after the event.</div>
            </article>
          </div>

          <div className="lp-how-detail">
            <div className="lp-how-detail-item"><WifiOffIcon size={17} /><div><strong>Built for bad WiFi</strong><span>Scans are stored locally and synchronized when the connection returns.</span></div></div>
            <div className="lp-how-detail-item"><ShieldCheckIcon size={17} /><div><strong>Designed for trust</strong><span>Signed tickets, ownership controls, rate limits, and audit records protect operations.</span></div></div>
            <div className="lp-how-detail-item"><CheckCircleIcon size={17} /><div><strong>Clear gate decisions</strong><span>Every scan gives the team a fast, readable answer at the door.</span></div></div>
          </div>
        </div>
      </section>

      {/* ── Auth Modal ── */}
      {showAuthModal && (
        <div className="lp-modal-overlay" onClick={handleCancelAuth}>
          <div className="lp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lp-modal-header">
              <div className="lp-modal-header-left">
                <div className="lp-modal-logo">
                  <ZapIcon size={16} />
                </div>
                <div>
                  <div className="lp-modal-title">Sign In</div>
                  <div className="lp-modal-subtitle">Access your organizer workspace</div>
                </div>
              </div>
              <button className="lp-modal-close" onClick={handleCancelAuth}>✕</button>
            </div>

            <div className="lp-modal-tabs">
              <button
                className={`lp-modal-tab ${activeTab === 'otp' ? 'lp-modal-tab-active' : ''}`}
                onClick={() => { setActiveTab('otp'); setResetMode(false); setError(null); }}
              >
                Passwordless OTP
              </button>
              <button
                className={`lp-modal-tab ${activeTab === 'password' ? 'lp-modal-tab-active' : ''}`}
                onClick={() => { setActiveTab('password'); setResetMode(false); setError(null); }}
              >
                Password
              </button>
            </div>

            <div className="lp-modal-body">
              {error && (
                <div className="lp-error-box">
                  <AlertTriangleIcon size={16} className="shrink-0" style={{ marginTop: '2px' }} />
                  <span>{error}</span>
                </div>
              )}

              {activeTab === 'otp' && (
                <div>
                  {otpStep === 'input_email' ? (
                    <form onSubmit={handleSendOtp}>
                      <div className="lp-form-group">
                        <label className="lp-form-label">Organizer Email</label>
                        <div className="lp-input-wrap">
                          <MailIcon size={16} className="lp-input-icon" />
                          <input
                            type="email"
                            required
                            value={otpEmail}
                            onChange={(e) => setOtpEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="lp-input"
                          />
                        </div>
                      </div>
                      <button type="submit" disabled={loading} className="lp-btn-submit">
                        {loading ? 'Sending...' : 'Send Passcode'}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyOtp}>
                      <div className="lp-otp-sent-info">
                        <div className="lp-otp-sent-label">Enter the 6-digit code sent to</div>
                        <div className="lp-otp-sent-email">{otpEmail}</div>
                      </div>

                      <div className="lp-otp-grid">
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
                            className="lp-otp-input"
                          />
                        ))}
                      </div>

                      <div className="lp-otp-actions">
                        <button type="button" onClick={() => { setOtpStep('input_email'); setOtpDigits(['', '', '', '', '', '']); }}>
                          ← Change email
                        </button>
                        <button
                          type="button"
                          disabled={otpCooldown > 0 || loading}
                          onClick={() => handleSendOtp()}
                          className={otpCooldown > 0 ? '' : 'lp-resend-active'}
                        >
                          {otpCooldown > 0 ? `Resend in ${otpCooldown}s` : 'Resend Code'}
                        </button>
                      </div>

                      <button
                        type="submit"
                        disabled={loading || otpDigits.join('').length !== 6}
                        className="lp-btn-submit"
                      >
                        {loading ? 'Verifying...' : 'Verify & Enter Workspace'}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {activeTab === 'password' && (
                resetMode ? (
                  <div>
                    <div className="lp-otp-sent-info">
                      <div className="lp-otp-sent-label">Reset your organizer password</div>
                      <div className="lp-otp-sent-email">A verification code will be sent to your email.</div>
                    </div>
                    {resetStep === 'input_email' ? (
                      <form onSubmit={handleSendPasswordResetOtp}>
                        <div className="lp-form-group">
                          <label className="lp-form-label">Organizer Email</label>
                          <div className="lp-input-wrap">
                            <MailIcon size={16} className="lp-input-icon" />
                            <input
                              type="email"
                              required
                              value={resetEmail}
                              onChange={(e) => setResetEmail(e.target.value)}
                              placeholder="you@example.com"
                              className="lp-input"
                            />
                          </div>
                        </div>
                        <button type="submit" disabled={loading} className="lp-btn-submit">
                          {loading ? 'Sending...' : 'Send Reset Code'}
                        </button>
                      </form>
                    ) : (
                      <form onSubmit={handleResetPassword}>
                        <div className="lp-otp-sent-info">
                          <div className="lp-otp-sent-label">Enter the code sent to</div>
                          <div className="lp-otp-sent-email">{resetEmail}</div>
                        </div>
                        <div className="lp-otp-grid">
                          {resetOtpDigits.map((digit, idx) => (
                            <input
                              key={idx}
                              ref={(el) => (resetOtpInputRefs.current[idx] = el)}
                              type="text"
                              inputMode="numeric"
                              maxLength={1}
                              value={digit}
                              onChange={(e) => handleResetOtpDigitChange(idx, e.target.value)}
                              className="lp-otp-input"
                            />
                          ))}
                        </div>
                        <div className="lp-form-group">
                          <label className="lp-form-label">New Password</label>
                          <input
                            type="password"
                            required
                            minLength={6}
                            value={resetPassword}
                            onChange={(e) => setResetPassword(e.target.value)}
                            className="lp-input"
                          />
                        </div>
                        <div className="lp-form-group">
                          <label className="lp-form-label">Confirm New Password</label>
                          <input
                            type="password"
                            required
                            minLength={6}
                            value={resetPasswordConfirmation}
                            onChange={(e) => setResetPasswordConfirmation(e.target.value)}
                            className="lp-input"
                          />
                        </div>
                        <div className="lp-otp-actions">
                          <button type="button" onClick={() => { setResetStep('input_email'); setResetOtpDigits(['', '', '', '', '', '']); }}>
                            ← Change email
                          </button>
                          <button
                            type="button"
                            disabled={resetCooldown > 0 || loading}
                            onClick={() => handleSendPasswordResetOtp()}
                            className={resetCooldown > 0 ? '' : 'lp-resend-active'}
                          >
                            {resetCooldown > 0 ? `Resend in ${resetCooldown}s` : 'Resend Code'}
                          </button>
                        </div>
                        <button type="submit" disabled={loading} className="lp-btn-submit">
                          {loading ? 'Resetting...' : 'Reset Password'}
                        </button>
                      </form>
                    )}
                    <button
                      type="button"
                      className="lp-modal-footer-link"
                      onClick={() => { setResetMode(false); setResetStep('input_email'); setError(null); }}
                    >
                      ← Back to sign in
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handlePasswordLogin}>
                    <div className="lp-form-group">
                      <label className="lp-form-label">Email</label>
                      <div className="lp-input-wrap">
                        <MailIcon size={16} className="lp-input-icon" />
                        <input
                          type="email"
                          required
                          value={passwordEmail}
                          onChange={(e) => setPasswordEmail(e.target.value)}
                          className="lp-input"
                        />
                      </div>
                    </div>
                    <div className="lp-form-group">
                      <label className="lp-form-label">Password</label>
                      <div className="lp-input-wrap">
                        <ShieldCheckIcon size={16} className="lp-input-icon" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="lp-input"
                          style={{ paddingRight: '44px' }}
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="lp-toggle-pw">
                          {showPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                        </button>
                      </div>
                    </div>
                    <button type="submit" disabled={loading} className="lp-btn-submit">
                      {loading ? 'Authenticating...' : 'Sign In'}
                    </button>
                    <button
                      type="button"
                      className="lp-modal-footer-link"
                      onClick={() => { setResetMode(true); setResetEmail(passwordEmail); setError(null); }}
                    >
                      Forgot password?
                    </button>
                  </form>
                )
              )}
            </div>

            <div className="lp-modal-footer">
              Don't have an account?{' '}
              <button
                className="lp-modal-footer-link"
                onClick={() => { setShowAuthModal(false); onNavigateToRegister(); }}
              >
                Register here
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
