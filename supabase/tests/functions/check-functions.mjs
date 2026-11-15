#!/usr/bin/env node
// Checks the deployed edge functions end to end with a fresh test account.
//
//   With fakes (no real keys):  FAKE_URL=http://127.0.0.1:54399 node supabase/tests/functions/check-functions.mjs
//   With real keys:             node supabase/tests/functions/check-functions.mjs
//
// Env: SUPABASE_URL, SUPABASE_ANON_KEY (default: supabase/tests/local-stack/.env.local),
//      DATABASE_URL (optional; enables checks that read server tables), CRON_SECRET,
//      APP_ORIGIN (an origin in ALLOWED_ORIGINS, default http://localhost:4185).
// With real keys only response-level checks run (Google consent and real push delivery need
// a person and a browser; the script prints what to try by hand).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const HERE = dirname(fileURLToPath(import.meta.url));
const stackEnv = join(HERE, '../local-stack/.env.local');
const fileEnv = existsSync(stackEnv)
  ? Object.fromEntries(
      readFileSync(stackEnv, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => l.split(/=(.*)/s).slice(0, 2)),
    )
  : {};
const env = { ...fileEnv, ...process.env };
const URL_ = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
const ANON = env.SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY;
const FAKE = env.FAKE_URL ?? '';
const ORIGIN = env.APP_ORIGIN ?? 'http://localhost:4185';
const CRON = env.CRON_SECRET ?? 'local-cron-secret';
if (!URL_ || !ANON) throw new Error('Set SUPABASE_URL and SUPABASE_ANON_KEY');

let failures = 0;
const ok = (cond, what) => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} - ${what}`);
  if (!cond) failures++;
};
const skip = (what) => console.log(`skip - ${what}`);
const psql = (sql) =>
  env.DATABASE_URL
    ? execFileSync('psql', [env.DATABASE_URL, '-At', '-c', sql], { encoding: 'utf8' }).trim()
    : null;
const fakeLog = async () => (FAKE ? (await fetch(`${FAKE}/__log`)).json() : []);
if (FAKE) await fetch(`${FAKE}/__reset`, { method: 'POST' });

const sb = createClient(URL_, ANON, { auth: { persistSession: false } });
const email = `check-${Date.now()}@example.com`;
const { data: signUp, error: signUpError } = await sb.auth.signUp({
  email,
  password: 'tiny steps 123',
});
if (signUpError || !signUp.session)
  throw new Error(
    `sign-up failed: ${signUpError?.message ?? 'no session (email confirmation on?)'}`,
  );
const token = signUp.session.access_token;
const uid = signUp.user.id;

async function call(name, body, headers = {}, path = '') {
  const res = await fetch(`${URL_}/functions/v1/${name}${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      apikey: ANON,
      'content-type': 'application/json',
      origin: ORIGIN,
      ...headers,
    },
    body: JSON.stringify(body),
  });
  return {
    status: res.status,
    cors: res.headers.get('access-control-allow-origin'),
    body: await res.json().catch(() => null),
  };
}

/* ------------------------------------------------------------------------- ai */
let r = await call('ai', { action: 'status' });
ok(r.status === 200 && r.cors === ORIGIN, 'ai: status answers with CORS for the app origin');
ok(
  (await call('ai', { action: 'status' }, { origin: 'https://evil.example' })).cors === null,
  'ai: no CORS for other origins',
);
ok(
  (await call('ai', { action: 'status' }, { authorization: 'Bearer nope' })).status === 401,
  'ai: refuses a bad JWT',
);
if (!r.body?.configured) {
  skip('ai: ANTHROPIC_API_KEY not set; only the unconfigured path was checked');
  ok(
    (await call('ai', { action: 'breakdown', title: 'x', lang: 'en' })).body?.error ===
      'not_configured',
    'ai: says not_configured',
  );
} else {
  const limit = r.body.limit;
  r = await call('ai', {
    action: 'breakdown',
    title: FAKE ? 'Essay RETRY-ME' : 'Write the history essay',
    lang: 'en',
  });
  const steps = r.body?.result ?? [];
  ok(
    r.status === 200 && steps.length >= 3 && steps.length <= 7 && steps[0].guessMinutes < 5,
    'ai: breakdown gives 3 to 7 steps, the first under 5 minutes',
  );
  r = await call('ai', { action: 'breakdown', title: 'نوشتن مقالهٔ تاریخ', lang: 'fa' });
  ok(
    r.status === 200 && (FAKE || /[؀-ۿ]/.test(r.body?.result?.[0]?.title ?? '')),
    'ai: Persian request answered (in Persian with real keys)',
  );
  r = await call('ai', { action: 'brain_dump', text: 'buy milk\ncall grandma', lang: 'en' });
  ok(r.status === 200 && r.body.result.length >= 2, 'ai: brain dump returns quests');
  r = await call('ai', { action: 'breakdown', title: 'x'.repeat(300), lang: 'en' });
  ok(r.status === 400 && r.body.error === 'bad_input', 'ai: oversized input refused');
  if (FAKE) {
    const ai = (await fakeLog()).filter((l) => l.kind === 'ai');
    ok(
      ai.length > 0 && ai.every((l) => l.schema && l.effort === 'low' && l.temperature === null),
      'ai: structured output, low effort, no sampling parameters',
    );
    ok(
      ai.some((l) => l.retry),
      'ai: an invalid reply was retried once',
    );
    ok(
      ai.every((l) => l.model !== 'claude-haiku-5-5' || l.fallbacks === null),
      'ai: no refusal fallback sent for Haiku',
    );
    const before = Number(psql(`select used from ai_quota where user_id='${uid}'`));
    r = await call('ai', { action: 'breakdown', title: 'BAD-OUTPUT', lang: 'en' });
    ok(
      r.status === 502 && r.body.error === 'bad_output',
      'ai: unusable model output ends in bad_output',
    );
    if (env.DATABASE_URL)
      ok(
        Number(psql(`select used from ai_quota where user_id='${uid}'`)) === before,
        'ai: that request was refunded',
      );
  }
  for (let i = 0; i < limit + 1; i++) {
    r = await call('ai', { action: 'suggest_meta', title: `Quest ${i}`, lang: 'en' });
    if (r.status === 429) break;
  }
  ok(
    r.status === 429 && r.body.error === 'limit_reached' && r.body.limit === limit,
    `ai: the daily limit (${limit}) is enforced`,
  );
}

/* ------------------------------------------------------------------- calendar */
r = await call('calendar', { action: 'status' });
ok(r.status === 200, 'calendar: status answers');
if (!r.body?.configured) {
  skip('calendar: GOOGLE_CLIENT_ID/SECRET not set; only the unconfigured path was checked');
} else {
  ok(
    (await call('calendar', { action: 'connect', returnTo: 'https://evil.example/x' })).status ===
      400,
    'calendar: return URL must be the app',
  );
  r = await call('calendar', { action: 'connect', returnTo: `${ORIGIN}/calendar` });
  const consent = new URL(r.body.url);
  ok(
    consent.searchParams.get('access_type') === 'offline' &&
      consent.searchParams.get('code_challenge_method') === 'S256' &&
      !!consent.searchParams.get('state'),
    'calendar: consent URL asks offline access with PKCE and state',
  );
  const forged = await fetch(`${URL_}/functions/v1/calendar/callback?state=forged&code=x`, {
    redirect: 'manual',
  });
  ok(forged.status === 400, 'calendar: a forged state is refused');
  if (!FAKE) {
    skip(`calendar: open this URL in a browser, approve, then rerun with the account: ${consent}`);
  } else {
    const state = consent.searchParams.get('state');
    let cb = await fetch(`${URL_}/functions/v1/calendar/callback?state=${state}&code=c`, {
      redirect: 'manual',
    });
    ok(
      cb.status === 302 && cb.headers.get('location') === `${ORIGIN}/calendar?calendar=connected`,
      'calendar: callback stores tokens and returns to the app',
    );
    cb = await fetch(`${URL_}/functions/v1/calendar/callback?state=${state}&code=c`, {
      redirect: 'manual',
    });
    ok(cb.status === 400, 'calendar: a state works once');
    r = await call('calendar', { action: 'status' });
    ok(r.body.connected && r.body.email === 'player@gmail.test', 'calendar: connected');
    const entityId = '0f8fad5b-d9cb-469f-a165-70867728950e';
    r = await call('calendar', {
      action: 'upsert',
      event: { type: 'quest', entityId, title: 'Essay', date: '2026-03-12' },
    });
    const events = async () => (await fetch(`${FAKE}/__events`)).json();
    ok(
      r.status === 200 &&
        r.body.eventId === 'qlq0f8fad5bd9cb469fa16570867728950e' &&
        (await events())[0]?.end?.date === '2026-03-13',
      'calendar: quest becomes an all-day event with a stable id',
    );
    r = await call('calendar', {
      action: 'upsert',
      event: { type: 'quest', entityId, title: 'Essay', date: '2026-03-12', done: true },
    });
    ok((await events())[0]?.summary === '✓ Essay', 'calendar: completion updates the same event');
    r = await call('calendar', {
      action: 'day',
      timeMin: '2026-03-10T00:00:00Z',
      timeMax: '2026-03-11T00:00:00Z',
    });
    ok(r.body?.events?.[0]?.title === 'Dentist', 'calendar: the day view reads events');
    r = await call('calendar', { action: 'delete', type: 'quest', entityId });
    ok(r.status === 200 && (await events()).length === 0, 'calendar: deletion follows');
    if (env.DATABASE_URL) {
      psql(
        `update google_tokens set refresh_token='revoked', access_token_expires_at=now() - interval '1 hour' where user_id='${uid}'`,
      );
      r = await call('calendar', {
        action: 'day',
        timeMin: '2026-03-10T00:00:00Z',
        timeMax: '2026-03-11T00:00:00Z',
      });
      ok(
        r.status === 409 &&
          r.body.error === 'reconnect' &&
          psql(`select count(*) from google_tokens where user_id='${uid}'`) === '0',
        'calendar: revoked access asks to reconnect and drops the tokens',
      );
    }
  }
}

/* ----------------------------------------------------------------------- push */
r = await call('push', { action: 'config' });
ok(r.status === 200, 'push: config answers');
ok(
  (await call('push', { action: 'tick' }, { 'x-cron-secret': 'wrong' })).status === 401,
  'push: tick needs the cron secret',
);
if (!r.body?.configured) {
  skip('push: VAPID keys not set; only the unconfigured path was checked');
} else if (!FAKE || !env.DATABASE_URL) {
  skip(
    'push: real delivery needs a browser; turn on "Notifications on this device" in Settings and use "test" from the README',
  );
} else {
  const sub = await (await fetch(`${FAKE}/__subscriber`)).json();
  await sb.auth.setSession({ access_token: token, refresh_token: signUp.session.refresh_token });
  const iso = (ms) => new Date(ms).toISOString();
  const now = Date.parse('2026-03-10T12:00:00Z');
  const base = {
    user_id: null,
    created_at: iso(now - 1e6),
    updated_at: iso(now - 1e6),
    deleted_at: null,
  };
  const push = (table, row) =>
    sb.rpc('sync_push', {
      p_table: table,
      p_client_now: iso(Date.now()),
      p_rows: [{ ...base, id: crypto.randomUUID(), ...row }],
    });
  await push('notification_prefs', {
    due_soon: true,
    due_soon_minutes: 60,
    daily_nudge: false,
    daily_nudge_time: '09:00',
    paused_reminder: false,
    quiet_hours_enabled: false,
    quiet_start: '22:00',
    quiet_end: '08:00',
    push_enabled: true,
  });
  await push('profile', { timezone: 'Asia/Tehran', display_name: '' });
  await push('settings', { language: 'fa' });
  await push('quests', {
    title: 'مقاله',
    status: 'active',
    due_date: '2026-03-10',
    due_time: '16:30',
  });
  psql(
    `insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ('${uid}', '${FAKE}/push/${uid}', '${sub.p256dh}', '${sub.auth}')`,
  );
  // 16:30 in Tehran is 13:00Z; due-soon 60 minutes before is 12:00Z.
  r = await call('push', { action: 'tick', now: now + 60_000 }, { 'x-cron-secret': CRON });
  ok(
    r.status === 200 && r.body.sent === 1,
    'push: tick sends the due-soon reminder (needs PUSH_ALLOW_TEST_NOW=on)',
  );
  const delivered = (await fakeLog()).filter((l) => l.kind === 'push');
  ok(
    delivered.length === 1 &&
      delivered[0].vapid &&
      delivered[0].encoding === 'aes128gcm' &&
      delivered[0].payload.body.includes('«مقاله»'),
    'push: VAPID-signed, decryptable, in the player language',
  );
  r = await call('push', { action: 'tick', now: now + 120_000 }, { 'x-cron-secret': CRON });
  ok(r.body.sent === 0, 'push: the same reminder is never sent twice');
}

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
