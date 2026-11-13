/**
 * In-app reminders while Questline is open (works for guests too): the same schedule as web
 * push, shown as a toast when the app is visible, or as a system notification when it is in
 * the background and the player allowed notifications (unless web push already covers it).
 * Each reminder fires once per device (keys kept in local_meta).
 */
import i18next from 'i18next';
import { db, getSingleton, localMeta } from '@/data';
import { showToast } from '@/ui';
import {
  remindersBetween,
  type Reminder,
} from '../../../../supabase/functions/_shared/reminders.ts';
import { useCloud } from '../store';

const FIRED_KEY = 'reminders.fired';
const TICK_MS = 30_000;
/** On start, reminders from the last few minutes still show (the app was just opened). */
const CATCH_UP_MS = 5 * 60_000;

export async function dueLocalReminders(from: number, to: number): Promise<Reminder[]> {
  const prefs = await getSingleton('notification_prefs');
  if (!prefs) return [];
  const timezone =
    (await getSingleton('profile'))?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const quests = (await db.quests.toArray()).filter((q) => q.due_date !== null);
  const sessions = (await db.focus_sessions.toArray()).filter(
    (s) => s.ended_at === null && s.deleted_at === null,
  );
  return remindersBetween({ timezone, prefs, quests, sessions }, from, to);
}

function text(r: Reminder) {
  const t = i18next.getFixedT(null, 'cloud');
  const quest = r.questTitle ?? '';
  switch (r.kind) {
    case 'due_soon':
      return {
        title: t('reminders.due_soon_title'),
        body: t('reminders.due_soon_body', { quest }),
      };
    case 'daily_nudge':
      return { title: t('reminders.nudge_title'), body: t('reminders.nudge_body') };
    case 'paused':
      return { title: t('reminders.paused_title'), body: t('reminders.paused_body', { quest }) };
  }
}

async function show(r: Reminder, pushCovers: boolean) {
  const { title, body } = text(r);
  if (document.visibilityState === 'visible') {
    showToast({ tone: 'info', icon: 'lantern', title, description: body, duration: 8000 });
    return;
  }
  if (pushCovers || typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return;
  }
  const options = { body, tag: r.key, icon: '/icons/icon-192.png', data: { url: '/' } };
  const reg = await navigator.serviceWorker?.getRegistration?.().catch(() => undefined);
  if (reg) await reg.showNotification(title, options);
  else new Notification(title, options);
}

export async function checkReminders(from: number, to: number): Promise<void> {
  const due = await dueLocalReminders(from, to);
  if (due.length === 0) return;
  const fired = new Set((await localMeta.get<string[]>(FIRED_KEY)) ?? []);
  const prefs = await getSingleton('notification_prefs');
  const pushCovers = !!prefs?.push_enabled && useCloud.getState().auth === 'signed_in';
  for (const r of due) {
    if (fired.has(r.key)) continue;
    fired.add(r.key);
    await show(r, pushCovers);
  }
  await localMeta.set(FIRED_KEY, [...fired].slice(-300));
}

export function startReminders(): () => void {
  if (typeof window === 'undefined') return () => undefined;
  let last = Date.now() - CATCH_UP_MS;
  const tick = () => {
    const now = Date.now();
    const from = last;
    last = now;
    void checkReminders(from, now).catch(() => undefined);
  };
  const first = setTimeout(tick, 3000);
  const timer = setInterval(tick, TICK_MS);
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}
