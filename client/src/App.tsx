import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { OfflineSyncProvider } from './context/OfflineSyncContext.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { Login } from './pages/Login.js';
import { RegisterOrganizer } from './pages/RegisterOrganizer.js';
import { Dashboard } from './pages/Dashboard.js';
import { LiveMode } from './pages/LiveMode.js';
import { PostEventSummary } from './pages/PostEventSummary.js';
import { AuditLogView } from './pages/AuditLogView.js';
import { PublicRegister } from './pages/PublicRegister.js';
import { SuperAdminDashboard } from './pages/SuperAdminDashboard.js';

// ─── Loading screen ───────────────────────────────────────────────────────────
const LoadingScreen: React.FC<{ label?: string }> = ({ label = 'Loading...' }) => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
      <span className="text-sm text-gray-400 font-medium tracking-wide">{label}</span>
    </div>
  </div>
);

// ─── Guards ───────────────────────────────────────────────────────────────────

/** Redirects to /login if the user is not authenticated. */
const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen label="Initializing GateKeeper..." />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

/** Redirects authenticated users away from login/register to the dashboard. */
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen label="Initializing GateKeeper..." />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

// ─── Route wrapper components ─────────────────────────────────────────────────
// Each wrapper bridges React Router's URL/params API with the existing
// page components' callback-prop navigation interface — so pages don't change.

const LoginRoute: React.FC = () => {
  const navigate = useNavigate();
  return (
    <Login
      onNavigateToRegister={() => navigate('/register')}
      onNavigateToLogin={() => navigate('/login')}
      onNavigateToPublicRegister={() => navigate('/attendees')}
      openAuthOnLoad
      onCancelAuth={() => navigate('/')}
    />
  );
};

const LandingRoute: React.FC = () => {
  const navigate = useNavigate();
  return (
    <Login
      onNavigateToRegister={() => navigate('/register')}
      onNavigateToLogin={() => navigate('/login')}
      onNavigateToPublicRegister={() => navigate('/attendees')}
    />
  );
};

const RegisterRoute: React.FC = () => {
  const navigate = useNavigate();
  return (
    <RegisterOrganizer
      onNavigateToLogin={() => navigate('/login')}
      onNavigateToPublicRegister={() => navigate('/attendees')}
    />
  );
};

const DashboardRoute: React.FC = () => {
  const navigate = useNavigate();
  return (
    <Dashboard
      onEnterLiveMode={(id) => navigate(`/events/${id}/live`)}
      onViewSummary={(id) => navigate(`/events/${id}/summary`)}
      onViewAuditLog={(id) => navigate(`/events/${id}/audit`)}
      onOpenPublicRegister={(id) => navigate(`/register?eventId=${id}`)}
      onNavigateToSuperAdmin={() => navigate('/super-admin')}
    />
  );
};

const LiveModeRoute: React.FC = () => {
  const { eventId = '' } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  return (
    <LiveMode
      eventId={eventId}
      onExit={() => navigate('/dashboard')}
      onEventEnded={() => navigate(`/events/${eventId}/summary`)}
    />
  );
};

const SummaryRoute: React.FC = () => {
  const { eventId = '' } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  return (
    <PostEventSummary
      eventId={eventId}
      onBack={() => navigate('/dashboard')}
    />
  );
};

const AuditRoute: React.FC = () => {
  const { eventId = '' } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  return (
    <AuditLogView
      eventId={eventId}
      onBack={() => navigate('/dashboard')}
    />
  );
};

const PublicRegisterRoute: React.FC = () => {
  const navigate = useNavigate();

  // Read optional ?eventId= from the query string
  const params = new URLSearchParams(window.location.search);
  const eventId = params.get('eventId') || params.get('event') || '';

  return (
    <PublicRegister
      eventId={eventId}
      onSelectEvent={(id) => navigate(`/register?eventId=${id}`)}
    />
  );
};

const RegisterPathRoute: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const hasEventId = Boolean(params.get('eventId') || params.get('event'));

  if (hasEventId) return <PublicRegisterRoute />;
  return (
    <PublicRoute>
      <RegisterRoute />
    </PublicRoute>
  );
};

const SuperAdminRoute: React.FC = () => {
  const navigate = useNavigate();
  return (
    <SuperAdminDashboard
      onBackToDashboard={() => navigate('/dashboard')}
      onNavigateToLiveMode={(id) => navigate(`/events/${id}/live`)}
      onNavigateToSummary={(id) => navigate(`/events/${id}/summary`)}
    />
  );
};

// ─── Main Router ──────────────────────────────────────────────────────────────
const AppRoutes: React.FC = () => (
  <ErrorBoundary>
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        {/* Public marketing landing page */}
        <Route
          path="/"
          element={
            <PublicRoute>
              <LandingRoute />
            </PublicRoute>
          }
        />

        {/* Auth routes — redirect to dashboard if already logged in */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginRoute />
            </PublicRoute>
          }
        />
        <Route path="/attendees" element={<PublicRegisterRoute />} />
        <Route
          path="/register"
          element={<RegisterPathRoute />}
        />

        {/* Protected organizer routes */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <ErrorBoundary>
                <DashboardRoute />
              </ErrorBoundary>
            </PrivateRoute>
          }
        />
        <Route
          path="/events/:eventId/live"
          element={
            <PrivateRoute>
              <ErrorBoundary>
                <LiveModeRoute />
              </ErrorBoundary>
            </PrivateRoute>
          }
        />
        <Route
          path="/events/:eventId/summary"
          element={
            <PrivateRoute>
              <ErrorBoundary>
                <SummaryRoute />
              </ErrorBoundary>
            </PrivateRoute>
          }
        />
        <Route
          path="/events/:eventId/audit"
          element={
            <PrivateRoute>
              <ErrorBoundary>
                <AuditRoute />
              </ErrorBoundary>
            </PrivateRoute>
          }
        />
        <Route
          path="/super-admin"
          element={
            <PrivateRoute>
              <ErrorBoundary>
                <SuperAdminRoute />
              </ErrorBoundary>
            </PrivateRoute>
          }
        />

        {/* Catch-all — redirect to dashboard (or login if unauthenticated) */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  </ErrorBoundary>
);

// ─── Root App ─────────────────────────────────────────────────────────────────
export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <OfflineSyncProvider>
          <AppRoutes />
        </OfflineSyncProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
