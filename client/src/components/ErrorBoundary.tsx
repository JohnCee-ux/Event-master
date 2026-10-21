import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Optional custom fallback UI. Receives the error and a reset function. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary — catches unhandled render/lifecycle errors in the React tree
 * and prevents the entire app from crashing. Displays a friendly recovery UI.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  private reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      if (fallback) return fallback(error, this.reset);

      // Default premium dark fallback UI
      return (
        <div
          style={{
            minHeight: '100vh',
            background: 'var(--c-bg, #17201D)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: 480,
              width: '100%',
              background: 'var(--c-surface, #202B27)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '1rem',
              padding: '2.5rem 2rem',
              textAlign: 'center',
            }}
          >
            {/* Icon */}
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '16px',
                background: 'rgba(201,70,53,0.14)',
                border: '1px solid rgba(201,70,53,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem',
                fontSize: 24,
              }}
            >
              ⚠️
            </div>

            <h2
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '1.25rem',
                fontWeight: 700,
                color: '#F4F1E8',
                letterSpacing: '-0.02em',
                marginBottom: '0.5rem',
              }}
            >
              Something went wrong
            </h2>

            <p
              style={{
                fontSize: '0.8125rem',
                color: '#91A098',
                lineHeight: 1.6,
                marginBottom: '1.5rem',
              }}
            >
              An unexpected error occurred in the application. The error has been logged.
            </p>

            {/* Error details (collapsed by default) */}
            <details
              style={{
                textAlign: 'left',
                background: 'rgba(0,0,0,0.25)',
                borderRadius: '0.5rem',
                padding: '0.75rem 1rem',
                marginBottom: '1.5rem',
                fontSize: '0.75rem',
                color: '#91A098',
              }}
            >
              <summary
                style={{ cursor: 'pointer', color: '#C4CBC4', fontWeight: 600, marginBottom: '0.5rem' }}
              >
                Error details
              </summary>
              <code
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: '#FCA5A5',
                  display: 'block',
                  marginTop: '0.5rem',
                }}
              >
                {error.message}
              </code>
            </details>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                onClick={this.reset}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '0.625rem 1.25rem',
                  borderRadius: '0.625rem',
                  background: 'linear-gradient(135deg, #E4573D 0%, #6D28D9 100%)',
                  border: 'none',
                  color: '#fff',
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                Try again
              </button>
              <button
                onClick={() => window.location.replace('/')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '0.625rem 1.25rem',
                  borderRadius: '0.625rem',
                  background: 'var(--c-surface-2, #293631)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#C4CBC4',
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                Go to home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}
