import mongoose, { Schema, Document } from 'mongoose';
import { AuditAction } from '../types.js';
import { isUsingMemoryStore } from '../config/db.js';
import { memoryStore } from '../config/memoryDb.js';

export interface IAuditLogDocument extends Document {
  eventId: any;
  attendeeId?: any | null;
  organizerId?: any | null;
  action: AuditAction;
  timestamp: Date;
  metadata?: Record<string, any>;
  attendeeName?: string;
  ticketCode?: string;
}

const AuditLogSchema = new Schema<IAuditLogDocument>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    attendeeId: { type: Schema.Types.ObjectId, ref: 'Attendee', default: null, index: true },
    organizerId: { type: Schema.Types.ObjectId, ref: 'Organizer', default: null },
    action: {
      type: String,
      required: true,
      enum: [
        'CREATE_EVENT',
        'UPDATE_EVENT',
        'PUBLISH_EVENT',
        'START_EVENT',
        'END_EVENT',
        'REGISTER_ATTENDEE',
        'CHECK_IN',
        'DUPLICATE_CHECK_IN',
        'INVALID_CHECK_IN',
        'UNDO_CHECK_IN',
        'RESEND_TICKET',
        'OFFLINE_SCAN_QUEUED',
        'OFFLINE_SCAN_SYNCED',
        'OFFLINE_SCAN_REJECTED',
      ],
      index: true,
    },
    timestamp: { type: Date, default: Date.now, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    attendeeName: { type: String, default: '' },
    ticketCode: { type: String, default: '' },
  },
  { timestamps: false, versionKey: false }
);

AuditLogSchema.index({ eventId: 1, timestamp: -1 });

const MongooseAuditLog = mongoose.model<IAuditLogDocument>('AuditLog', AuditLogSchema);

export const AuditLog: any = {
  findOne: (query: any) => (isUsingMemoryStore ? memoryStore.auditLogs.findOne(query) : MongooseAuditLog.findOne(query)),
  findById: (id: any) => (isUsingMemoryStore ? memoryStore.auditLogs.findById(id) : MongooseAuditLog.findById(id)),
  create: (data: any) => (isUsingMemoryStore ? memoryStore.auditLogs.create(data) : MongooseAuditLog.create(data)),
  find: (query: any = {}) => (isUsingMemoryStore ? memoryStore.auditLogs.find(query) : MongooseAuditLog.find(query)),
  countDocuments: (query: any = {}) => (isUsingMemoryStore ? memoryStore.auditLogs.countDocuments(query) : MongooseAuditLog.countDocuments(query)),
  deleteMany: (query: any = {}) => (isUsingMemoryStore ? memoryStore.auditLogs.deleteMany(query) : MongooseAuditLog.deleteMany(query)),
};
