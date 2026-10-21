import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-dashed border-white/10 bg-white/[0.01] ${className}`}
    >
      {icon ? (
        <div className="w-14 h-14 mb-4 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-brand-purple">
          {icon}
        </div>
      ) : (
        <div className="w-12 h-12 mb-4 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-gray-400">
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
        </div>
      )}
      <h3 className="text-base font-semibold text-white mb-1 font-display">{title}</h3>
      <p className="text-sm text-gray-400 max-w-sm mb-6 leading-relaxed">
        {description}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 rounded-xl text-sm font-medium bg-brand-purple hover:bg-brand-purple/90 text-white transition-all duration-150 shadow-lg shadow-brand-purple/20 active:scale-[0.98]"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};
