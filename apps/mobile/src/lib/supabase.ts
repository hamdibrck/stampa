import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { authStorage } from './storage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * null until the Supabase project is configured (docs/TODO-MANUAL.md). The app is fully usable
 * as a guest without it: stamping, counters and search only need the embedded data.
 */
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          storage: authStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      })
    : null;

export const isBackendConfigured = supabase !== null;
