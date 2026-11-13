// Edge function `calendar`: Google Calendar for one player.
//
// POST (JWT): status, connect { returnTo }, disconnect, day { timeMin, timeMax },
//             upsert { event }, delete { type, entityId }
// GET  /calendar/callback?code&state: Google's OAuth redirect (no JWT; checked by `state`).
//
// Tokens are stored server-side only (public.google_tokens, no client access). Offline access
// with PKCE; the one-time `state` is bound to the player and expires after 10 minutes.
// Revoked access (invalid_grant) deletes the tokens and asks the app to reconnect.
//
// Secrets / env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ALLOWED_ORIGINS,
// GOOGLE_REDIRECT_URI (optional; default <SUPABASE_URL>/functions/v1/calendar/callback).
import {
  eventBody,
  eventIdFor,
  toDayEvents,
  validEventInput,
  type CalendarEntity,
} from '../_shared/calendar.ts';
import { corsHeaders, json, originAllowed, readJson } from '../_shared/http.ts';
import { adminClient, allowedOrigins, env, requireUser } from '../_shared/supabase.ts';

const SCOPES = [
  'openid',
  'email',
  // Read the player's events for the day view (free time).
  'https://www.googleapis.com/auth/calendar.readonly',
  // Create and manage only calendars made by this app (the "Questline" calendar).
  'https://www.googleapis.com/auth/calendar.app.created',
].join(' ');

/** Tests can point every Google URL at a fake server. */
const googleBase = () => env('GOOGLE_FAKE_BASE');
const AUTH_URL = () => `${googleBase() || 'https://accounts.google.com'}/o/oauth2/v2/auth`;
const TOKEN_URL = () => `${googleBase() || 'https://oauth2.googleapis.com'}/token`;
const REVOKE_URL = () => `${googleBase() || 'https://oauth2.googleapis.com'}/revoke`;
const API = () => `${googleBase() || 'https://www.googleapis.com'}/calendar/v3`;

const configured = () => env('GOOGLE_CLIENT_ID') !== '' && env('GOOGLE_CLIENT_SECRET') !== '';
const redirectUri = () =>
  env('GOOGLE_REDIRECT_URI', `${env('SUPABASE_URL')}/functions/v1/calendar/callback`);

class Reconnect extends Error {}

function log(fields: Record<string, unknown>) {
  console.log(JSON.stringify({ fn: 'calendar', ...fields }));
}

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const random = (n: number) => b64url(crypto.getRandomValues(new Uint8Array(n)));

interface TokenRow {
  user_id: string;
  google_email: string | null;
  refresh_token: string;
  access_token: string | null;
  access_token_expires_at: string | null;
  calendar_id: string | null;
}

async function tokenRow(userId: string): Promise<TokenRow | null> {
  const { data } = await adminClient()
    .from('google_tokens')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return (data as TokenRow | null) ?? null;
}

async function tokenRequest(params: Record<string, string>) {
  const res = await fetch(TOKEN_URL(), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env('GOOGLE_CLIENT_ID'),
      client_secret: env('GOOGLE_CLIENT_SECRET'),
      ...params,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, body };
}

/** A valid access token, refreshed when needed. Throws Reconnect when access was revoked. */
async function accessToken(row: TokenRow): Promise<string> {
  const expires = row.access_token_expires_at ? Date.parse(row.access_token_expires_at) : 0;
  if (row.access_token && expires - Date.now() > 60_000) return row.access_token;
  const { ok, body } = await tokenRequest({
    grant_type: 'refresh_token',
    refresh_token: row.refresh_token,
  });
  if (!ok) {
    if (body.error === 'invalid_grant') {
      await adminClient().from('google_tokens').delete().eq('user_id', row.user_id);
      throw new Reconnect();
    }
    throw new Error('refresh_failed');
  }
  const access = String(body.access_token);
  await adminClient()
    .from('google_tokens')
    .update({
      access_token: access,
      access_token_expires_at: new Date(
        Date.now() + Number(body.expires_in ?? 3600) * 1000,
      ).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', row.user_id);
  return access;
}

async function google(token: string, path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${API()}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (res.status === 401) throw new Reconnect();
  return res;
}

/** The dedicated "Questline" calendar, created on first use (and again if deleted). */
async function questlineCalendar(row: TokenRow, token: string, timezone?: string): Promise<string> {
  if (row.calendar_id) {
    const check = await google(token, `/calendars/${encodeURIComponent(row.calendar_id)}`);
    if (check.ok) return row.calendar_id;
  }
  const res = await google(token, '/calendars', {
    method: 'POST',
    body: JSON.stringify({ summary: 'Questline', ...(timezone ? { timeZone: timezone } : {}) }),
  });
  if (!res.ok) throw new Error(`calendar_create_${res.status}`);
  const id = String(((await res.json()) as { id: string }).id);
  await adminClient().from('google_tokens').update({ calendar_id: id }).eq('user_id', row.user_id);
  row.calendar_id = id;
  return id;
}

function decodeIdTokenEmail(idToken: unknown): string | null {
  if (typeof idToken !== 'string') return null;
  try {
    const payload = idToken.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/');
    return (JSON.parse(atob(payload)) as { email?: string }).email ?? null;
  } catch {
    return null;
  }
}

async function callback(url: URL): Promise<Response> {
  const state = url.searchParams.get('state') ?? '';
  const code = url.searchParams.get('code');
  const db = adminClient();
  const { data: saved } = await db
    .from('oauth_states')
    .select('*')
    .eq('state', state)
    .maybeSingle();
  if (saved) await db.from('oauth_states').delete().eq('state', state);
  const fresh = saved && Date.now() - Date.parse(saved.created_at as string) < 10 * 60_000;
  if (!saved || !fresh)
    return new Response('This link has expired. Please try again from Questline.', { status: 400 });
  const back = (result: string) => {
    const target = new URL(saved.return_to as string);
    target.searchParams.set('calendar', result);
    return Response.redirect(target.toString(), 302);
  };
  if (!code) return back(url.searchParams.get('error') === 'access_denied' ? 'denied' : 'error');

  const { ok, body } = await tokenRequest({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(),
    code_verifier: saved.code_verifier as string,
  });
  if (!ok || typeof body.access_token !== 'string') {
    log({ action: 'callback', outcome: 'token_error' });
    return back('error');
  }
  const existing = await tokenRow(saved.user_id as string);
  const refresh = (body.refresh_token as string | undefined) ?? existing?.refresh_token;
  if (!refresh) return back('error');
  const row: TokenRow = {
    user_id: saved.user_id as string,
    google_email: decodeIdTokenEmail(body.id_token) ?? existing?.google_email ?? null,
    refresh_token: refresh,
    access_token: body.access_token,
    access_token_expires_at: new Date(
      Date.now() + Number(body.expires_in ?? 3600) * 1000,
    ).toISOString(),
    calendar_id: existing?.calendar_id ?? null,
  };
  await db
    .from('google_tokens')
    .upsert({ ...row, scope: String(body.scope ?? ''), updated_at: new Date().toISOString() });
  try {
    await questlineCalendar(row, row.access_token!);
  } catch {
    // Created on first sync instead.
  }
  log({ action: 'callback', outcome: 'connected' });
  return back('connected');
}

async function sha256(text: string): Promise<string> {
  return b64url(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))),
  );
}

export async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  if (req.method === 'GET' && url.pathname.endsWith('/callback')) {
    if (!configured()) return new Response('Google Calendar is not set up.', { status: 503 });
    return callback(url);
  }
  const cors = corsHeaders(req.headers.get('origin'), allowedOrigins());
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'failed' }, 405, cors);

  const user = await requireUser(req);
  if (!user) return json({ error: 'not_signed_in' }, 401, cors);
  let body: Record<string, unknown>;
  try {
    body = (await readJson(req, 16_000)) as Record<string, unknown>;
  } catch {
    return json({ error: 'bad_input' }, 400, cors);
  }

  if (body.action === 'status') {
    const row = configured() ? await tokenRow(user.id) : null;
    return json(
      { configured: configured(), connected: !!row, email: row?.google_email ?? null },
      200,
      cors,
    );
  }
  if (!configured()) return json({ error: 'not_configured' }, 503, cors);

  if (body.action === 'connect') {
    const returnTo = typeof body.returnTo === 'string' ? body.returnTo : '';
    let origin = '';
    try {
      origin = new URL(returnTo).origin;
    } catch {
      // invalid
    }
    // Only back to the app itself: never an open redirect.
    if (!originAllowed(origin, allowedOrigins())) return json({ error: 'bad_input' }, 400, cors);
    const state = random(24);
    const verifier = random(48);
    await adminClient()
      .from('oauth_states')
      .insert({ state, user_id: user.id, code_verifier: verifier, return_to: returnTo });
    await adminClient()
      .from('oauth_states')
      .delete()
      .lt('created_at', new Date(Date.now() - 3_600_000).toISOString());
    const auth = new URL(AUTH_URL());
    auth.search = new URLSearchParams({
      client_id: env('GOOGLE_CLIENT_ID'),
      redirect_uri: redirectUri(),
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
      code_challenge: await sha256(verifier),
      code_challenge_method: 'S256',
      ...(user.email ? { login_hint: user.email } : {}),
    }).toString();
    return json({ url: auth.toString() }, 200, cors);
  }

  const row = await tokenRow(user.id);
  if (body.action === 'disconnect') {
    if (row) {
      await fetch(`${REVOKE_URL()}?token=${encodeURIComponent(row.refresh_token)}`, {
        method: 'POST',
      }).catch(() => undefined);
      await adminClient().from('google_tokens').delete().eq('user_id', user.id);
    }
    log({ action: 'disconnect' });
    return json({ ok: true }, 200, cors);
  }
  if (!row) return json({ error: 'not_connected' }, 409, cors);

  try {
    const token = await accessToken(row);
    switch (body.action) {
      case 'day': {
        const timeMin = String(body.timeMin ?? '');
        const timeMax = String(body.timeMax ?? '');
        if (Number.isNaN(Date.parse(timeMin)) || Number.isNaN(Date.parse(timeMax))) {
          return json({ error: 'bad_input' }, 400, cors);
        }
        const q = new URLSearchParams({
          timeMin,
          timeMax,
          singleEvents: 'true',
          orderBy: 'startTime',
          maxResults: '100',
        });
        const res = await google(token, `/calendars/primary/events?${q}`);
        if (!res.ok) return json({ error: 'failed' }, 502, cors);
        const items = ((await res.json()) as { items?: unknown[] }).items ?? [];
        return json({ events: toDayEvents(items) }, 200, cors);
      }
      case 'upsert': {
        const input = validEventInput(body.event);
        if (!input) return json({ error: 'bad_input' }, 400, cors);
        const calendarId = await questlineCalendar(row, token, input.timezone);
        const event = eventBody(input);
        const path = `/calendars/${encodeURIComponent(calendarId)}/events`;
        let res = await google(token, `${path}/${event.id}`, {
          method: 'PUT',
          body: JSON.stringify(event),
        });
        if (res.status === 404)
          res = await google(token, path, { method: 'POST', body: JSON.stringify(event) });
        if (res.status === 409)
          res = await google(token, `${path}/${event.id}`, {
            method: 'PUT',
            body: JSON.stringify({ ...event, status: 'confirmed' }),
          });
        if (!res.ok) return json({ error: 'failed' }, 502, cors);
        const saved = (await res.json()) as { id: string; etag?: string };
        return json({ calendarId, eventId: saved.id, etag: saved.etag ?? null }, 200, cors);
      }
      case 'delete': {
        const type = body.type as CalendarEntity;
        if ((type !== 'quest' && type !== 'focus_block') || typeof body.entityId !== 'string') {
          return json({ error: 'bad_input' }, 400, cors);
        }
        if (row.calendar_id) {
          const res = await google(
            token,
            `/calendars/${encodeURIComponent(row.calendar_id)}/events/${eventIdFor(type, body.entityId)}`,
            { method: 'DELETE' },
          );
          if (!res.ok && res.status !== 404 && res.status !== 410)
            return json({ error: 'failed' }, 502, cors);
        }
        return json({ ok: true }, 200, cors);
      }
      default:
        return json({ error: 'bad_input' }, 400, cors);
    }
  } catch (error) {
    if (error instanceof Reconnect) {
      log({ action: String(body.action), outcome: 'reconnect' });
      return json({ error: 'reconnect' }, 409, cors);
    }
    log({ action: String(body.action), outcome: 'error' });
    return json({ error: 'failed' }, 502, cors);
  }
}

if (import.meta.main) Deno.serve(handler);
