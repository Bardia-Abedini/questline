// Supabase access for edge functions (Deno only). The service role key never leaves the
// server; user requests are verified with the caller's JWT.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.119.0';
import { bearer } from './http.ts';

export function env(name: string, fallback = ''): string {
  return Deno.env.get(name)?.trim() || fallback;
}

let admin: SupabaseClient | null = null;

/** Service-role client: bypasses RLS. Use only for server-only tables and checked user ids. */
export function adminClient(): SupabaseClient {
  admin ??= createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}

export interface AuthedUser {
  id: string;
  email: string | null;
}

/** Verifies the request's JWT with Supabase Auth. Null when missing or invalid. */
export async function requireUser(req: Request): Promise<AuthedUser | null> {
  const token = bearer(req);
  if (!token) return null;
  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

/** Allowed browser origins for CORS (see _shared/http.ts). */
export function allowedOrigins(): string {
  return env('ALLOWED_ORIGINS', 'http://localhost:*');
}
