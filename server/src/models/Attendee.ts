import mongoose, { Schema, Document } from 'mongoose';
import { isUsingMemoryStore } from '../config/db.js';
import { memoryStore } from '../config/memoryDb.js';

export interface IAttendeeDocument extends Document {
  eventId: any;
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
}

const AttendeeSchema = new Schema<IAttendeeDocument>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    ticketType: { type: String, default: 'General', trim: true },
    ticketCode: { type: String, required: true, trim: true },
    qrToken: { type: String, required: true, trim: true, index: true },
    registeredAt: { type: Date, default: Date.now },
    checkedInAt: { type: Date, default: null },
    checkedInBy: { type: String, default: null },
    emailSent: { type: Boolean, default: false },
    emailLastAttemptAt: { type: Date, default: null },
    offlineScanIds: { type: [String], default: [] },
  },
  { timestamps: true }
);

AttendeeSchema.index({ eventId: 1, email: 1 }, { unique: true });
AttendeeSchema.index({ eventId: 1, ticketCode: 1 }, { unique: true });
AttendeeSchema.index({ eventId: 1, checkedInAt: 1 });
AttendeeSchema.index({ eventId: 1, qrToken: 1 });

const MongooseAttendee = mongoose.model<IAttendeeDocument>('Attendee', AttendeeSchema);

export const Attendee: any = {
  findOne: (query: any) => (isUsingMemoryStore ? memoryStore.attendees.findOne(query) : MongooseAttendee.findOne(query)),
  findOneAndUpdate: (query: any, update: any) => (
    isUsingMemoryStore
      ? memoryStore.attendees.findOneAndUpdate(query, update)
      : MongooseAttendee.findOneAndUpdate(query, update, { new: true })
  ),
  findById: (id: any) => (isUsingMemoryStore ? memoryStore.attendees.findById(id) : MongooseAttendee.findById(id)),
  create: (data: any) => (isUsingMemoryStore ? memoryStore.attendees.create(data) : MongooseAttendee.create(data)),
  find: (query: any = {}) => (isUsingMemoryStore ? memoryStore.attendees.find(query) : MongooseAttendee.find(query)),
  countDocuments: (query: any = {}) => (isUsingMemoryStore ? memoryStore.attendees.countDocuments(query) : MongooseAttendee.countDocuments(query)),
  aggregate: (pipeline: any[]) => (isUsingMemoryStore ? memoryStore.attendees.aggregate(pipeline) : MongooseAttendee.aggregate(pipeline)),
  deleteMany: (query: any = {}) => (isUsingMemoryStore ? memoryStore.attendees.deleteMany(query) : MongooseAttendee.deleteMany(query)),
  findByIdAndDelete: (id: any) => (isUsingMemoryStore ? memoryStore.attendees.findByIdAndDelete(id) : MongooseAttendee.findByIdAndDelete(id)),
};
