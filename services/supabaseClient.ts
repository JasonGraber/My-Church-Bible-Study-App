import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { isNative } from './platform';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';

let supabaseClient: SupabaseClient | null = null;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase environment variables. Auth and data sync will be disabled.');
} else {
  try {
    // In the phone apps, sign-in with Google or Apple returns through a deep link carrying a one-time
    // code (PKCE). On the website the session comes back in the page address.
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { flowType: isNative ? 'pkce' : 'implicit', detectSessionInUrl: !isNative, persistSession: true, autoRefreshToken: true },
    });
  } catch (e) {
    console.error('Failed to initialize Supabase client:', e);
  }
}

export const supabase = supabaseClient as SupabaseClient;

export const isSupabaseConfigured = () => !!SUPABASE_URL && !!SUPABASE_KEY && !!supabaseClient;
export const getSupabaseConfig = () => ({ url: SUPABASE_URL, key: SUPABASE_KEY });
export const saveSupabaseConfig = () => {}; // No-op
