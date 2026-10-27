import { supabase } from './supabase.js';

export const connectDB = async (): Promise<string> => {
  const { error } = await supabase.from('organizers').select('id').limit(1);
  if (error) throw new Error(`Supabase connection failed: ${error.message}`);
  console.log('Connected successfully to Supabase PostgreSQL');
  return process.env.SUPABASE_URL || 'supabase';
};

export const closeDB = async (): Promise<void> => {
  // Supabase uses pooled HTTP connections; there is no process-local connection to close.
};
