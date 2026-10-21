import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'card';
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'text',
  width,
  height,
}) => {
  const baseClasses = 'animate-pulse bg-white/5 rounded';

  const variantClasses = {
    text: 'h-4 w-full rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
    card: 'rounded-xl h-32 w-full',
  }[variant];

  const style: React.CSSProperties = {
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
  };

  return <div className={`${baseClasses} ${variantClasses} ${className}`} style={style} />;
};

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 5,
  cols = 4,
}) => (
  <div className="w-full space-y-3 p-4">
    {/* Table header skeleton */}
    <div className="flex gap-4 pb-2 border-b border-white/5">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={`th-${i}`} className="h-4 flex-1" />
      ))}
    </div>
    {/* Rows skeleton */}
    {Array.from({ length: rows }).map((_, r) => (
      <div key={`tr-${r}`} className="flex gap-4 py-2 items-center">
        {Array.from({ length: cols }).map((_, c) => (
          <Skeleton
            key={`td-${r}-${c}`}
            className={`h-5 flex-1 ${c === 0 ? 'w-1/3' : ''}`}
          />
        ))}
      </div>
    ))}
  </div>
);

export const MetricSkeleton: React.FC = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
    {Array.from({ length: 4 }).map((_, i) => (
      <div
        key={`metric-${i}`}
        className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3"
      >
        <div className="flex justify-between items-center">
          <Skeleton className="h-4 w-24" />
          <Skeleton variant="circular" className="w-8 h-8" />
        </div>
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-3 w-32" />
      </div>
    ))}
  </div>
);
