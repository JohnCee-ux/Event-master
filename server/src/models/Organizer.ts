import mongoose, { Schema, Document } from 'mongoose';
import { isUsingMemoryStore } from '../config/db.js';
import { memoryStore } from '../config/memoryDb.js';

export interface IOrganizerDocument extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: 'organizer' | 'superadmin';
  createdAt: Date;
  updatedAt: Date;
}

const OrganizerSchema = new Schema<IOrganizerDocument>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['organizer', 'superadmin'], default: 'organizer' },
  },
  { timestamps: true }
);

const MongooseOrganizer = mongoose.model<IOrganizerDocument>('Organizer', OrganizerSchema);

export const Organizer: any = {
  findOne: (query: any) => (isUsingMemoryStore ? memoryStore.organizers.findOne(query) : MongooseOrganizer.findOne(query)),
  findById: (id: any) => (isUsingMemoryStore ? memoryStore.organizers.findById(id) : MongooseOrganizer.findById(id)),
  create: (data: any) => (isUsingMemoryStore ? memoryStore.organizers.create(data) : MongooseOrganizer.create(data)),
  find: (query: any = {}) => (isUsingMemoryStore ? memoryStore.organizers.find(query) : MongooseOrganizer.find(query)),
  countDocuments: (query: any = {}) => (isUsingMemoryStore ? memoryStore.organizers.countDocuments(query) : MongooseOrganizer.countDocuments(query)),
  findByIdAndDelete: (id: any) => (isUsingMemoryStore ? memoryStore.organizers.findByIdAndDelete(id) : MongooseOrganizer.findByIdAndDelete(id)),
  deleteOne: (query: any = {}) => (isUsingMemoryStore ? memoryStore.organizers.deleteOne(query) : MongooseOrganizer.deleteOne(query)),
  deleteMany: (query: any = {}) => (isUsingMemoryStore ? memoryStore.organizers.deleteMany(query) : MongooseOrganizer.deleteMany(query)),
};
