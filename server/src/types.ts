export type EventStatus = 'DRAFT' | 'UPCOMING' | 'LIVE' | 'ENDED';

export type TicketType = 'General' | 'VIP' | 'Speaker' | 'Staff' | 'Press' | string;

export interface IOrganizer {
  id: string;
  name: string;
  email: string;
  role?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IEvent {
  id: string;
  name: string;
  description: string;
  date: string;
  startTime: string;
  venue: string;
  capacity: number;
  status: EventStatus;
  prefix: string;
  organizerId: string;
  startedAt?: string | null;
  endedAt?: string | null;
  registeredCount?: number;
  checkedInCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface IAttendee {
  id: string;
  eventId: string;
  name: string;
  email: string;
  ticketType: TicketType;
  ticketCode: string;
  qrToken: string;
  registeredAt: string;
  checkedInAt: string | null;
  checkedInBy?: string | null;
  emailSent: boolean;
  emailLastAttemptAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AuditAction =
  | 'CREATE_EVENT'
  | 'UPDATE_EVENT'
  | 'PUBLISH_EVENT'
  | 'START_EVENT'
  | 'END_EVENT'
  | 'REGISTER_ATTENDEE'
  | 'CHECK_IN'
  | 'DUPLICATE_CHECK_IN'
  | 'INVALID_CHECK_IN'
  | 'UNDO_CHECK_IN'
  | 'RESEND_TICKET'
  | 'OFFLINE_SCAN_QUEUED'
  | 'OFFLINE_SCAN_SYNCED'
  | 'OFFLINE_SCAN_REJECTED';

export interface IAuditLog {
  id: string;
  eventId: string;
  attendeeId?: string | null;
  organizerId?: string;
  action: AuditAction;
  timestamp: string;
  metadata?: Record<string, any>;
  attendeeName?: string;
  ticketCode?: string;
}

export type CheckInStatus = 'VALID' | 'DUPLICATE' | 'INVALID' | 'QUEUED';

export interface CheckInResponse {
  status: 'VALID' | 'DUPLICATE' | 'INVALID';
  message: string;
  attendee?: {
    id: string;
    name: string;
    email: string;
    ticketType: string;
    ticketCode: string;
    checkedInAt?: string | null;
    originalCheckedInAt?: string | null;
  };
  checkInTime?: string;
}

export interface IOfflineScan {
  scanId: string;
  eventId: string;
  ticketCodeOrToken: string;
  timestamp: string;
  deviceId: string;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  attemptCount: number;
  lastAttemptAt?: string;
  lastError?: string;
  source: 'camera' | 'manual';
  resultStatus?: CheckInStatus;
  attendeeName?: string;
  ticketType?: string;
}

export interface SyncCheckInRequest {
  eventId: string;
  deviceId: string;
  scans: {
    scanId: string;
    ticketCodeOrToken: string;
    timestamp: string;
    source?: 'camera' | 'manual';
  }[];
}

export interface SyncCheckInResponse {
  totalProcessed: number;
  results: {
    scanId: string;
    status: 'VALID' | 'DUPLICATE' | 'INVALID' | 'FAILED';
    message: string;
    attendee?: {
      id: string;
      name: string;
      email: string;
      ticketType: string;
      ticketCode: string;
      checkedInAt?: string | null;
      originalCheckedInAt?: string | null;
    };
    error?: string;
  }[];
}

export interface CheckInTimePoint {
  time: string;
  count: number;
  cumulative: number;
}

export interface IEventAnalytics {
  registeredCount: number;
  checkedInCount: number;
  remainingCapacity: number;
  capacity: number;
  attendanceRate: number;
  ticketTypeBreakdown: Record<string, { registered: number; checkedIn: number }>;
  checkInsOverTime: CheckInTimePoint[];
  recentCheckInRate: number;
}

export interface IPostEventSummary {
  eventId: string;
  eventName: string;
  venue: string;
  date: string;
  startedAt?: string | null;
  endedAt?: string | null;
  registeredCount: number;
  checkedInCount: number;
  attendanceRate: number;
  noShowCount: number;
  firstCheckInAt: string | null;
  lastCheckInAt: string | null;
  peakCheckInPeriod: string | null;
  ticketTypeBreakdown: Record<string, { registered: number; checkedIn: number }>;
  checkInsOverTime: CheckInTimePoint[];
  emailFailureCount: number;
  duplicateScanCount: number;
  invalidScanCount: number;
  offlineScansQueued: number;
  offlineScansSynced: number;
}

export interface RegistrationResponse {
  success: boolean;
  message: string;
  attendee: {
    id: string;
    name: string;
    email: string;
    ticketType: string;
    ticketCode: string;
    qrToken: string;
    qrDataUrl: string;
    registeredAt: string;
    emailSent: boolean;
  };
  event: {
    id: string;
    name: string;
    venue: string;
    date: string;
    startTime: string;
  };
}
