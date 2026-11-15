/**
 * Cloud configuration from build-time env (see .env.example). With nothing set the app is a
 * complete guest app: no network calls, no Supabase code loaded.
 */
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '';

export const cloudConfig = {
  url,
  anonKey,
  /** Accounts, sync, AI, calendar and push need a Supabase project. */
  configured: url.length > 0 && anonKey.length > 0,
};

/** Base URL of an edge function. */
export function functionUrl(name: 'ai' | 'calendar' | 'push'): string {
  return `${cloudConfig.url.replace(/\/$/, '')}/functions/v1/${name}`;
}
