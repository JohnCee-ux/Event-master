import { EventStatus } from '../types.js';
import { createCollection } from './supabaseModel.js';
import { supabase } from '../config/supabase.js';

export interface IEventDocument {
  _id: string;
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
  organizerId: string;
  startedAt?: Date | null;
  endedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  save: () => Promise<IEventDocument>;
}

const collection: any = createCollection('events', {
  _id: 'id',
  imageDataUrl: 'image_data_url',
  startTime: 'start_time',
  registeredCount: 'registered_count',
  organizerId: 'organizer_id',
  startedAt: 'started_at',
  endedAt: 'ended_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

export const Event: any = {
  ...collection,
  findOneAndUpdate: async (query: any, update: any) => {
    if (update?.$inc?.registeredCount === 1 && query?._id && query?.$or) {
      const { data, error } = await supabase.rpc('reserve_event_capacity', { p_event_id: query._id.toString() });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return null;
      return collection.findById(row.id);
    }
    return collection.findOneAndUpdate(query, update);
  },
};
