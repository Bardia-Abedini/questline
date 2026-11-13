// Edge function `push`: web push subscriptions and scheduled reminders.
//
// Player actions (JWT required): config, subscribe, unsubscribe, unsubscribe_all, test.
// Scheduler action: tick (header `x-cron-secret: <CRON_SECRET>`), run every 5 minutes by
// pg_cron (see supabase/README.md). It sends due reminders (see _shared/reminders.ts) to every
// subscribed device of players who turned push on, once per reminder (reminder_log).
//
// Secrets / env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET,
// ALLOWED_ORIGINS. Reminder texts never reach the logs.
import { corsHeaders, json, readJson } from '../_shared/http.ts';
import {
  addDays,
  reminderText,
  reminderUrl,
  remindersBetween,
  type ReminderPrefs,
} from '../_shared/reminders.ts';
import { adminClient, allowedOrigins, env, requireUser } from '../_shared/supabase.ts';
import { sendWebPush, type VapidKeys } from '../_shared/webpush.ts';

/** Reminders due in the last 15 minutes are sent; older ones are skipped, never late-spammed. */
const WINDOW_MS = 15 * 60_000;

function vapid(): VapidKeys | null {
  const publicKey = env('VAPID_PUBLIC_KEY');
  const privateKey = env('VAPID_PRIVATE_KEY');
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject: env('VAPID_SUBJECT', 'mailto:admin@example.com') };
}

function log(fields: Record<string, unknown>) {
  console.log(JSON.stringify({ fn: 'push', ...fields }));
}

interface SubRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  failure_count?: number;
}

async function deliver(subs: SubRow[], message: Record<string, unknown>, keys: VapidKeys) {
  const db = adminClient();
  let sent = 0;
  for (const s of subs) {
    try {
      const r = await sendWebPush(s, message, keys, { topic: String(message.tag ?? '') });
      if (r.gone) await db.from('push_subscriptions').delete().eq('id', s.id);
      else if (r.ok) {
        sent++;
        await db
          .from('push_subscriptions')
          .update({ last_success_at: new Date().toISOString(), failure_count: 0 })
          .eq('id', s.id);
      } else {
        await db
          .from('push_subscriptions')
          .update({ failure_count: (s.failure_count ?? 0) + 1 })
          .eq('id', s.id);
      }
    } catch {
      // Network error to the push service: try again on the next reminder.
    }
  }
  return sent;
}

async function tick(now: number, keys: VapidKeys) {
  const db = adminClient();
  const { data: subs } = await db
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth, failure_count');
  const byUser = new Map<string, SubRow[]>();
  for (const s of (subs ?? []) as SubRow[]) {
    byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);
  }
  let reminders = 0;
  let sent = 0;
  const today = new Date(now).toISOString().slice(0, 10);
  for (const [userId, userSubs] of byUser) {
    const [{ data: prefsRows }, { data: profile }, { data: settings }] = await Promise.all([
      db
        .from('notification_prefs')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at')
        .limit(1),
      db
        .from('profile')
        .select('timezone')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at')
        .limit(1),
      db
        .from('settings')
        .select('language')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at')
        .limit(1),
    ]);
    const prefs = prefsRows?.[0] as (ReminderPrefs & { push_enabled: boolean }) | undefined;
    if (!prefs?.push_enabled) continue;
    const [{ data: quests }, { data: sessions }] = await Promise.all([
      db
        .from('quests')
        .select('id, title, status, due_date, due_time, deleted_at')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .gte('due_date', addDays(today, -1))
        .lte('due_date', addDays(today, 2)),
      db
        .from('focus_sessions')
        .select('id, quest_id, ended_at, deleted_at, pauses')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .is('ended_at', null),
    ]);
    const due = remindersBetween(
      {
        timezone: (profile?.[0]?.timezone as string | undefined) ?? 'UTC',
        prefs,
        quests: quests ?? [],
        sessions: sessions ?? [],
      },
      now - WINDOW_MS,
      now,
    );
    const lang = (settings?.[0]?.language as string | undefined) ?? 'en';
    for (const r of due) {
      // Claim the reminder first: only one scheduler run sends it.
      const { data: claimed } = await db
        .from('reminder_log')
        .upsert(
          { user_id: userId, fire_key: r.key },
          { onConflict: 'user_id,fire_key', ignoreDuplicates: true },
        )
        .select('fire_key');
      if (!claimed?.length) continue;
      reminders++;
      sent += await deliver(
        userSubs,
        { ...reminderText(r, lang), url: reminderUrl(r), tag: r.key, kind: r.kind },
        keys,
      );
    }
  }
  await db
    .from('reminder_log')
    .delete()
    .lt('sent_at', new Date(now - 14 * 86_400_000).toISOString());
  return { users: byUser.size, reminders, sent };
}

function validSubscription(v: unknown): { endpoint: string; p256dh: string; auth: string } | null {
  const s = v as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null;
  if (!s || typeof s.endpoint !== 'string' || s.endpoint.length > 1000) return null;
  try {
    if (new URL(s.endpoint).protocol !== 'https:') return null;
  } catch {
    return null;
  }
  const p256dh = s.keys?.p256dh;
  const auth = s.keys?.auth;
  if (typeof p256dh !== 'string' || typeof auth !== 'string') return null;
  if (p256dh.length > 200 || auth.length > 100) return null;
  return { endpoint: s.endpoint, p256dh, auth };
}

export async function handler(req: Request): Promise<Response> {
  const cors = corsHeaders(req.headers.get('origin'), allowedOrigins());
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'failed' }, 405, cors);

  let body: Record<string, unknown>;
  try {
    body = (await readJson(req, 8_000)) as Record<string, unknown>;
  } catch {
    return json({ error: 'bad_input' }, 400, cors);
  }
  const keys = vapid();

  if (body.action === 'tick') {
    const secret = env('CRON_SECRET');
    if (!secret || req.headers.get('x-cron-secret') !== secret) {
      return json({ error: 'not_signed_in' }, 401, cors);
    }
    if (!keys) return json({ error: 'not_configured' }, 503, cors);
    const now =
      typeof body.now === 'number' && env('PUSH_ALLOW_TEST_NOW') === 'on' ? body.now : Date.now();
    const result = await tick(now, keys);
    log({ action: 'tick', ...result });
    return json(result, 200, cors);
  }

  const user = await requireUser(req);
  if (!user) return json({ error: 'not_signed_in' }, 401, cors);
  const db = adminClient();

  switch (body.action) {
    case 'config':
      return json({ configured: !!keys, publicKey: keys?.publicKey ?? null }, 200, cors);
    case 'subscribe': {
      if (!keys) return json({ error: 'not_configured' }, 503, cors);
      const sub = validSubscription(body.subscription);
      if (!sub) return json({ error: 'bad_input' }, 400, cors);
      const userAgent = typeof body.userAgent === 'string' ? body.userAgent.slice(0, 200) : null;
      // An endpoint belongs to one browser: it moves to whoever subscribed it last.
      const { error } = await db
        .from('push_subscriptions')
        .upsert(
          { ...sub, user_id: user.id, user_agent: userAgent, failure_count: 0 },
          { onConflict: 'endpoint' },
        );
      if (error) return json({ error: 'failed' }, 500, cors);
      log({ action: 'subscribe' });
      return json({ ok: true }, 200, cors);
    }
    case 'unsubscribe': {
      if (typeof body.endpoint !== 'string') return json({ error: 'bad_input' }, 400, cors);
      await db
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user.id)
        .eq('endpoint', body.endpoint);
      return json({ ok: true }, 200, cors);
    }
    case 'unsubscribe_all':
      await db.from('push_subscriptions').delete().eq('user_id', user.id);
      return json({ ok: true }, 200, cors);
    case 'test': {
      if (!keys) return json({ error: 'not_configured' }, 503, cors);
      const { data } = await db
        .from('push_subscriptions')
        .select('id, user_id, endpoint, p256dh, auth, failure_count')
        .eq('user_id', user.id);
      const lang = body.lang === 'fa' ? 'fa' : 'en';
      const sent = await deliver(
        (data ?? []) as SubRow[],
        {
          title: lang === 'fa' ? 'یادآورها روشن است' : 'Reminders are on',
          body:
            lang === 'fa'
              ? 'یادآورهای Questline اینجا نشان داده می‌شوند.'
              : 'Questline reminders will show up like this.',
          url: '/settings',
          tag: 'test',
        },
        keys,
      );
      return json({ ok: true, sent }, 200, cors);
    }
    default:
      return json({ error: 'bad_input' }, 400, cors);
  }
}

if (import.meta.main) Deno.serve(handler);
