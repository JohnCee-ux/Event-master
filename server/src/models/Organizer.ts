import { createCollection } from './supabaseModel.js';

export interface IOrganizerDocument {
  _id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'organizer' | 'superadmin';
  createdAt: Date;
  updatedAt: Date;
  save: () => Promise<IOrganizerDocument>;
}

export const Organizer: any = createCollection('organizers', {
  _id: 'id',
  passwordHash: 'password_hash',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});
