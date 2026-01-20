import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase environment variables');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export const isSupabaseConfigured = () => !!SUPABASE_URL && !!SUPABASE_KEY;
export const getSupabaseConfig = () => ({ url: SUPABASE_URL, key: SUPABASE_KEY });
export const saveSupabaseConfig = () => {}; // No-op
