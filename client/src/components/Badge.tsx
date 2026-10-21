import React from 'react';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'live';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string; dotColor: string }> = {
  success: {
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    text: 'text-emerald-400',
    dotColor: 'bg-emerald-400',
  },
  warning: {
    bg: 'bg-amber-500/10 border-amber-500/20',
    text: 'text-amber-400',
    dotColor: 'bg-amber-400',
  },
  error: {
    bg: 'bg-rose-500/10 border-rose-500/20',
    text: 'text-rose-400',
    dotColor: 'bg-rose-400',
  },
  info: {
    bg: 'bg-sky-500/10 border-sky-500/20',
    text: 'text-sky-400',
    dotColor: 'bg-sky-400',
  },
  neutral: {
    bg: 'bg-white/5 border-white/10',
    text: 'text-gray-300',
    dotColor: 'bg-gray-400',
  },
  live: {
    bg: 'bg-emerald-500/15 border-emerald-500/30',
    text: 'text-emerald-400',
    dotColor: 'bg-emerald-400 animate-ping',
  },
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
  className = '',
}) => {
  const styles = variantStyles[variant];
  const sizeClasses =
    size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-medium';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${styles.bg} ${styles.text} ${sizeClasses} ${className}`}
    >
      {dot && (
        <span className="relative flex h-2 w-2">
          {variant === 'live' && (
            <span
              className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${styles.dotColor}`}
            />
          )}
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${variant === 'live' ? 'bg-emerald-500' : styles.dotColor}`}
          />
        </span>
      )}
      {children}
    </span>
  );
};
