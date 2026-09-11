import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { ShieldCheckIcon, AlertTriangleIcon } from '../components/icons/CustomIcons.js';

interface RegisterOrganizerProps {
  onNavigateToLogin: () => void;
}

export const RegisterOrganizer: React.FC<RegisterOrganizerProps> = ({ onNavigateToLogin }) => {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
          Create Organizer Account
        </p>
      </div>

      {/* Flat dark panel registration card */}
      <div className="w-full max-w-md panel p-8">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white">Create your organizer workspace</h2>
          <p className="text-xs text-gray-400 mt-0.5">Set up registration, door scanning, and post-event reporting.</p>
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
              Full Name or Organization
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex Turner / Apex Events"
              className="input-dark"
            />
          </div>

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
              Password (min. 6 chars)
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input-dark"
              autoComplete="new-password"
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
                <span>Creating account...</span>
              </div>
            ) : (
              'Create Organizer Account'
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-surface-border text-center">
          <p className="text-xs text-gray-400">
            Already have an account?{' '}
            <button
              type="button"
              onClick={onNavigateToLogin}
              className="text-brand-blue hover:text-blue-400 font-medium transition-colors"
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
