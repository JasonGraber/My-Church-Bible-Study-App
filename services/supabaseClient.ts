import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://thhqwidylgoxbfdxnqta.supabase.co';
const SUPABASE_KEY = 'sb_publishable_NvwWH9ATUJIpCRpUHHz4lg_bRjkFroX';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export const isSupabaseConfigured = () => true;
export const getSupabaseConfig = () => ({ url: SUPABASE_URL, key: SUPABASE_KEY });
export const saveSupabaseConfig = () => {}; // No-op
