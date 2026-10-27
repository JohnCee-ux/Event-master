import { createCollection } from './supabaseModel.js';
import { supabase } from '../config/supabase.js';

export interface IAttendeeDocument {
  _id: string;
  eventId: string;
  name: string;
  email: string;
  ticketType: string;
  ticketCode: string;
  qrToken: string;
  registeredAt: Date;
  checkedInAt?: Date | null;
  checkedInBy?: string | null;
  emailSent: boolean;
  emailLastAttemptAt?: Date | null;
  offlineScanIds: string[];
  createdAt: Date;
  updatedAt: Date;
  save: () => Promise<IAttendeeDocument>;
}

const collection: any = createCollection('attendees', {
  _id: 'id',
  eventId: 'event_id',
  ticketType: 'ticket_type',
  ticketCode: 'ticket_code',
  qrToken: 'qr_token',
  registeredAt: 'registered_at',
  checkedInAt: 'checked_in_at',
  checkedInBy: 'checked_in_by',
  emailSent: 'email_sent',
  emailLastAttemptAt: 'email_last_attempt_at',
  offlineScanIds: 'offline_scan_ids',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

export const Attendee: any = {
  ...collection,
  findOneAndUpdate: async (query: any, update: any) => {
    if (update?.$set?.checkedInAt && update?.$addToSet?.offlineScanIds && query?._id) {
      const { data, error } = await supabase.rpc('claim_attendee_checkin', {
        p_attendee_id: query._id.toString(),
        p_checked_in_at: update.$set.checkedInAt,
        p_checked_in_by: update.$set.checkedInBy || null,
        p_scan_id: update.$addToSet.offlineScanIds,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return null;
      return collection.findById(row.id);
    }
    return collection.findOneAndUpdate(query, update);
  },
};
