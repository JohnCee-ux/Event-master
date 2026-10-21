import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
}

const defaultProps = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const CheckIcon: React.FC<IconProps> = ({ size, className, ...props }) => (
  <svg {...defaultProps} width={size || 24} height={size || 24} className={className} {...props}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export const CheckCircleIcon: React.FC<IconProps> = ({ size, className, ...props }) => (
  <svg {...defaultProps} width={size || 24} height={size || 24} className={className} {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

export const XMarkIcon: React.FC<IconProps> = ({ size, className, ...props }) => (
  <svg {...defaultProps} width={size || 24} height={size || 24} className={className} {...props}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const XCircleIcon: React.FC<IconProps> = ({ size, className, ...props }) => (
  <svg {...defaultProps} width={size || 24} height={size || 24} className={className} {...props}>
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);

export const RepeatIcon: React.FC<IconProps> = ({ size, className, ...props }) => (
  <svg {...defaultProps} width={size || 24} height={size || 24} className={className} {...props}>
    <path d="m17 2 4 4-4 4" />
    <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
    <path d="m7 22-4-4 4-4" />
    <path d="M21 13v1a4 4 0 0 1-4 4H3" />
  </svg>
);

export const CloudOfflineIcon: React.FC<IconProps> = ({ size, className, ...props }) => (
  <svg {...defaultProps} width={size || 24} height={size || 24} className={className} {...props}>
    <path d="M22.61 16.95A5 5 0 0 0 18 10h-1.26a8 8 0 0 0-7.05-6M5 5a8 8 0 0 0-4 7h1.26" />
    <path d="M8.63 18.7A5 5 0 0 0 18 18" />
    <line x1="2" y1="2" x2="22" y2="22" />
  </svg>
);

export const CloudSyncIcon: React.FC<IconProps> = ({ size, className, ...props }) => (
  <svg {...defaultProps} width={size || 24} height={size || 24} className={className} {...props}>
    <path d="M12 2a10 10 0 0 0-9.95 9h2.02A8 8 0 1 1 12 20v2a10 10 0 0 0 0-20z" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

export const CameraIcon: React.FC<IconProps> = ({ size, className, ...props }) => (
  <svg {...defaultProps} width={size || 24} height={size || 24} className={className} {...props}>
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
    <circle cx="12" cy="13" r="3" />
  </svg>
);

export const CameraSwitchIcon: React.FC<IconProps> = ({ size, className, ...props }) => (
  <svg {...defaultProps} width={size || 24} height={size || 24} className={className} {...props}>
    <path d="M20 10c0-4.418-3.582-8-8-8s-8 3.582-8 8" />
    <path d="m4 6-4 4 4 4" />
    <path d="M4 14c0 4.418 3.582 8 8 8s8-3.582 8-8" />
    <path d="m20 18 4-4-4-4" />
  </svg>
);

export const FlashlightIcon: React.FC<IconProps> = ({ size, className, ...props }) => (
  <svg {...defaultProps} width={size || 24} height={size || 24} className={className} {...props}>
    <path d="M18 6c0 2-2 4-2 7v6a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-6c0-3-2-5-2-7V2h12v4z" />
    <line x1="6" y1="6" x2="18" y2="6" />
    <line x1="12" y1="12" x2="12" y2="12" />
  </svg>
);

export const SoundOnIcon: React.FC<IconProps> = ({ size, className, ...props }) => (
  <svg {...defaultProps} width={size || 24} height={size || 24} className={className} {...props}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </svg>
);

export const SoundOffIcon: React.FC<IconProps> = ({ size, className, ...props }) => (
  <svg {...defaultProps} width={size || 24} height={size || 24} className={className} {...props}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <line x1="23" y1="9" x2="17" y2="15" />
    <line x1="17" y1="9" x2="23" y2="15" />
  </svg>
);

export const TicketIcon: React.FC<IconProps> = ({ size, className, ...props }) => (
  <svg {...defaultProps} width={size || 24} height={size || 24} className={className} {...props}>
    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
    <path d="M13 5v2" />
    <path d="M13 17v2" />
    <path d="M13 11v2" />
  </svg>
);

export const UserIcon: React.FC<IconProps> = ({ size, className, ...props }) => (
  <svg {...defaultProps} width={size || 24} height={size || 24} className={className} {...props}>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

export const UsersIcon: React.FC<IconProps> = ({ size, className, ...props }) => (
  <svg {...defaultProps} width={size || 24} height={size || 24} className={className} {...props}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export const SearchIcon: React.FC<IconProps> = ({ size, className, ...props }) => (
  <svg {...defaultProps} width={size || 24} height={size || 24} className={className} {...props}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

export const FilterIcon: React.FC<IconProps> = ({ size, className, ...props }) => (
  <svg {...defaultProps} width={size || 24} height={size || 24} className={className} {...props}>
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

export const DownloadIcon: React.FC<IconProps> = ({ size, className, ...props }) => (
  <svg {...defaultProps} width={size || 24} height={size || 24} className={className} {...props}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

export const MailIcon: React.FC<IconProps> = ({ size, className, ...props }) => (
  <svg {...defaultProps} width={size || 24} height={size || 24} className={className} {...props}>
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

export const UndoIcon: React.FC<IconProps> = ({ size, className, ...props }) => (
  <svg {...defaultProps} width={size || 24} height={size || 24} className={className} {...props}>
    <path d="M3 7v6h6" />
    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
  </svg>
);

export const BarChartIcon: React.FC<IconProps> = ({ size, className, ...props }) => (
  <svg {...defaultProps} width={size || 24} height={size || 24} className={className} {...props}>
    <line x1="12" y1="20" x2="12" y2="10" />
    <line x1="18" y1="20" x2="18" y2="4" />
    <line x1="6" y1="20" x2="6" y2="16" />
  </svg>
);

export const CalendarIcon: React.FC<IconProps> = ({ size, className, ...props }) => (
  <svg {...defaultProps} width={size || 24} height={size || 24} className={className} {...props}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

export const ClockIcon: React.FC<IconProps> = ({ size, className, ...props }) => (
  <svg {...defaultProps} width={size || 24} height={size || 24} className={className} {...props}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

export const MapPinIcon: React.FC<IconProps> = ({ size, className, ...props }) => (
  <svg {...defaultProps} width={size || 24} height={size || 24} className={className} {...props}>
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

export const ShieldCheckIcon: React.FC<IconProps> = ({ size, className, ...props }) => (
  <svg {...defaultProps} width={size || 24} height={size || 24} className={className} {...props}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);

export const ArrowRightIcon: React.FC<IconProps> = ({ size, className, ...props }) => (
  <svg {...defaultProps} width={size || 24} height={size || 24} className={className} {...props}>
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

export const ArrowLeftIcon: React.FC<IconProps> = ({ size, className, ...props }) => (
  <svg {...defaultProps} width={size || 24} height={size || 24} className={className} {...props}>
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

export const PlusIcon: React.FC<IconProps> = ({ size, className, ...props }) => (
  <svg {...defaultProps} width={size || 24} height={size || 24} className={className} {...props}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export const RefreshCwIcon: React.FC<IconProps> = ({ size, className, ...props }) => (
  <svg {...defaultProps} width={size || 24} height={size || 24} className={className} {...props}>
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

export const LogOutIcon: React.FC<IconProps> = ({ size, className, ...props }) => (
  <svg {...defaultProps} width={size || 24} height={size || 24} className={className} {...props}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

export const SparklesIcon: React.FC<IconProps> = ({ size, className, ...props }) => (
  <svg {...defaultProps} width={size || 24} height={size || 24} className={className} {...props}>
    <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
  </svg>
);

export const AlertTriangleIcon: React.FC<IconProps> = ({ size, className, ...props }) => (
  <svg {...defaultProps} width={size || 24} height={size || 24} className={className} {...props}>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

export const RadioIcon: React.FC<IconProps> = ({ size, className, ...props }) => (
  <svg {...defaultProps} width={size || 24} height={size || 24} className={className} {...props}>
    <circle cx="12" cy="12" r="2" />
    <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
  </svg>
);

export const HistoryIcon: React.FC<IconProps> = ({ size, className, ...props }) => (
  <svg {...defaultProps} width={size || 24} height={size || 24} className={className} {...props}>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <polyline points="3 3 3 8 8 8" />
    <polyline points="12 7 12 12 15 15" />
  </svg>
);

export const EyeIcon: React.FC<IconProps> = ({ size, className, ...props }) => (
  <svg {...defaultProps} width={size || 24} height={size || 24} className={className} {...props}>
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const EyeOffIcon: React.FC<IconProps> = ({ size, className, ...props }) => (
  <svg {...defaultProps} width={size || 24} height={size || 24} className={className} {...props}>
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    <line x1="2" y1="2" x2="22" y2="22" />
  </svg>
);

export const ZapIcon: React.FC<IconProps> = ({ size, className, ...props }) => (
  <svg {...defaultProps} width={size || 24} height={size || 24} className={className} {...props}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

export const QrCodeIcon: React.FC<IconProps> = ({ size, className, ...props }) => (
  <svg {...defaultProps} width={size || 24} height={size || 24} className={className} {...props}>
    <rect width="5" height="5" x="3" y="3" rx="1" />
    <rect width="5" height="5" x="16" y="3" rx="1" />
    <rect width="5" height="5" x="3" y="16" rx="1" />
    <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
    <path d="M21 21v.01" />
    <path d="M12 7v3a2 2 0 0 1-2 2H7" />
    <path d="M3 12h.01" />
    <path d="M12 3h.01" />
    <path d="M12 16v.01" />
    <path d="M16 12h1" />
    <path d="M21 12v.01" />
    <path d="M12 21v-1" />
  </svg>
);

export const CopyIcon: React.FC<IconProps> = ({ size, className, ...props }) => (
  <svg {...defaultProps} width={size || 24} height={size || 24} className={className} {...props}>
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
);

export const ExternalLinkIcon: React.FC<IconProps> = ({ size, className, ...props }) => (
  <svg {...defaultProps} width={size || 24} height={size || 24} className={className} {...props}>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

export const TrendingUpIcon: React.FC<IconProps> = ({ size, className, ...props }) => (
  <svg {...defaultProps} width={size || 24} height={size || 24} className={className} {...props}>
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

export const WifiOffIcon: React.FC<IconProps> = ({ size, className, ...props }) => (
  <svg {...defaultProps} width={size || 24} height={size || 24} className={className} {...props}>
    <line x1="2" y1="2" x2="22" y2="22" />
    <path d="M8.5 16.5a5 5 0 0 1 7 0" />
    <path d="M2 8.82a15 15 0 0 1 4.17-2.65" />
    <path d="M10.66 5c4.01-.36 8.14.9 11.34 3.82" />
    <path d="M5 12.86A10 10 0 0 1 19 12.86" />
  </svg>
);

