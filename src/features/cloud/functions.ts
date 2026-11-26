/** Calls an edge function with the player's session. */
import { cloudConfig, functionUrl } from './config';
import { getSupabase } from './supabaseClient';

export type FunctionErrorCode =
  | 'not_signed_in'
  | 'offline'
  | 'not_configured'
  | 'limit_reached'
  | 'bad_input'
  | 'bad_output'
  | 'not_connected'
  | 'reconnect'
  | 'failed';

export class FunctionError extends Error {
  constructor(
    public readonly code: FunctionErrorCode,
    public readonly detail: Record<string, unknown> = {},
  ) {
    super(code);
    this.name = 'FunctionError';
  }
}

const KNOWN = new Set<string>([
  'not_signed_in',
  'not_configured',
  'limit_reached',
  'bad_input',
  'bad_output',
  'not_connected',
  'reconnect',
]);

export async function accessToken(): Promise<string | null> {
  const client = await getSupabase();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function callFunction<T>(
  name: 'ai' | 'calendar' | 'push',
  body: Record<string, unknown>,
): Promise<T> {
  if (!cloudConfig.configured) throw new FunctionError('not_signed_in');
  const token = await accessToken();
  if (!token) throw new FunctionError('not_signed_in');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new FunctionError('offline');
  }
  let response: Response;
  try {
    response = await fetch(functionUrl(name), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        apikey: cloudConfig.anonKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new FunctionError('offline');
  }
  let json: Record<string, unknown> = {};
  try {
    json = (await response.json()) as Record<string, unknown>;
  } catch {
    // Not JSON (e.g. a gateway error page).
  }
  if (!response.ok) {
    const code = String(json.error ?? '');
    if (response.status === 401) throw new FunctionError('not_signed_in', json);
    throw new FunctionError(KNOWN.has(code) ? (code as FunctionErrorCode) : 'failed', json);
  }
  return json as T;
}
