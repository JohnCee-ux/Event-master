import mongoose, { Schema, Document } from 'mongoose';
import { EventStatus } from '../types.js';
import { isUsingMemoryStore } from '../config/db.js';
import { memoryStore } from '../config/memoryDb.js';

export interface IEventDocument extends Document {
  name: string;
  description: string;
  imageDataUrl?: string | null;
  date: string;
  startTime: string;
  venue: string;
  capacity: number;
  registeredCount: number;
  status: EventStatus;
  prefix: string;
  organizerId: any;
  startedAt?: Date | null;
  endedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const EventSchema = new Schema<IEventDocument>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    imageDataUrl: { type: String, default: null },
    date: { type: String, required: true },
    startTime: { type: String, required: true },
    venue: { type: String, required: true, trim: true },
    capacity: { type: Number, required: true, min: 1, default: 100 },
    registeredCount: { type: Number, required: true, min: 0, default: 0 },
    status: {
      type: String,
      enum: ['DRAFT', 'UPCOMING', 'LIVE', 'ENDED'],
      default: 'DRAFT',
      required: true,
      index: true,
    },
    prefix: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      minlength: 2,
      maxlength: 8,
      default: 'EVT',
    },
    organizerId: { type: Schema.Types.ObjectId, ref: 'Organizer', required: true, index: true },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const MongooseEvent = mongoose.model<IEventDocument>('Event', EventSchema);

export const Event: any = {
  findOne: (query: any) => (isUsingMemoryStore ? memoryStore.events.findOne(query) : MongooseEvent.findOne(query)),
  findOneAndUpdate: (query: any, update: any) => (
    isUsingMemoryStore
      ? memoryStore.events.findOneAndUpdate(query, update)
      : MongooseEvent.findOneAndUpdate(query, update, { new: true })
  ),
  findById: (id: any) => (isUsingMemoryStore ? memoryStore.events.findById(id) : MongooseEvent.findById(id)),
  create: (data: any) => (isUsingMemoryStore ? memoryStore.events.create(data) : MongooseEvent.create(data)),
  find: (query: any = {}) => (isUsingMemoryStore ? memoryStore.events.find(query) : MongooseEvent.find(query)),
  countDocuments: (query: any = {}) => (isUsingMemoryStore ? memoryStore.events.countDocuments(query) : MongooseEvent.countDocuments(query)),
  findByIdAndDelete: (id: any) => (isUsingMemoryStore ? memoryStore.events.findByIdAndDelete(id) : MongooseEvent.findByIdAndDelete(id)),
  deleteMany: (query: any = {}) => (isUsingMemoryStore ? memoryStore.events.deleteMany(query) : MongooseEvent.deleteMany(query)),
};
