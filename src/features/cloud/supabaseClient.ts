/**
 * The Supabase client, created on first use and only when configured. The library is loaded
 * with a dynamic import so a guest-only build never downloads it.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { cloudConfig } from './config';

let clientPromise: Promise<SupabaseClient | null> | null = null;

export function getSupabase(): Promise<SupabaseClient | null> {
  if (!cloudConfig.configured) return Promise.resolve(null);
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(cloudConfig.url, cloudConfig.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storageKey: 'ql.auth',
      },
    }),
  );
  return clientPromise;
}
