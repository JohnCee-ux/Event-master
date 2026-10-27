import { AuditAction } from '../types.js';
import { createCollection } from './supabaseModel.js';

export interface IAuditLogDocument {
  _id: string;
  eventId: string;
  attendeeId?: string | null;
  organizerId?: string | null;
  action: AuditAction;
  timestamp: Date;
  metadata?: Record<string, any>;
  attendeeName?: string;
  ticketCode?: string;
}

export const AuditLog: any = createCollection('audit_logs', {
  _id: 'id',
  eventId: 'event_id',
  attendeeId: 'attendee_id',
  organizerId: 'organizer_id',
  createdAt: 'created_at',
  attendeeName: 'attendee_name',
  ticketCode: 'ticket_code',
});
