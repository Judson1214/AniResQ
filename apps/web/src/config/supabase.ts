import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabaseAnonKey = rawAnonKey?.startsWith('b64:')
  ? (typeof atob !== 'undefined' ? atob(rawAnonKey.slice(4)) : Buffer.from(rawAnonKey.slice(4), 'base64').toString('utf-8'))
  : rawAnonKey;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
