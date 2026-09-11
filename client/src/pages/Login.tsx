import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { ShieldCheckIcon, AlertTriangleIcon } from '../components/icons/CustomIcons.js';

interface LoginProps {
  onNavigateToRegister: () => void;
}

export const Login: React.FC<LoginProps> = ({ onNavigateToRegister }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login({ email, password });
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center px-4 py-12">
      {/* Brand Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-surface-subtle border border-surface-border text-brand-blue mb-4">
          <ShieldCheckIcon size={32} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          GateKeeper
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Organizer Sign In & Event Operations
        </p>
      </div>

      {/* Flat dark panel sign-in card */}
      <div className="w-full max-w-md panel p-8">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white">Sign in to run your event doors</h2>
          <p className="text-xs text-gray-400 mt-0.5">Use your organizer account to manage registration and check-in.</p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-lg bg-signal-red/10 border border-signal-red/30 flex items-start gap-2.5 text-signal-red text-sm">
            <AlertTriangleIcon size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-300 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@yourcompany.com"
              className="input-dark"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input-dark"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-2.5 mt-2 text-sm font-medium"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Signing in...</span>
              </div>
            ) : (
              'Sign In to Dashboard'
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-surface-border text-center">
          <p className="text-xs text-gray-400">
            Don't have an organizer account?{' '}
            <button
              type="button"
              onClick={onNavigateToRegister}
              className="text-brand-blue hover:text-blue-400 font-medium transition-colors"
            >
              Create an account
            </button>
          </p>
        </div>
      </div>

      <div className="mt-8 text-center text-xs text-gray-500">
        GateKeeper Event Check-In System &bull; Fast & Durable Door Operations
      </div>
    </div>
  );
};
