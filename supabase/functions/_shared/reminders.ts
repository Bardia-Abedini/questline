/**
 * Reminder scheduling: which reminders are due at a moment, in the player's time zone, with
 * quiet hours and per-type switches. Pure (time is a parameter), shared by the `push` edge
 * function (web push) and the app (in-app reminders while it is open).
 *
 * Kinds (plan section 12), all off by default except due-soon:
 * - due_soon: `due_soon_minutes` before a quest's due time; for a quest due on a day without a
 *   time, at 09:00 that day ("due today").
 * - daily_nudge: every day at `daily_nudge_time` ("time to quest").
 * - paused: a focus session left paused for 15 minutes ("you left a quest paused").
 *
 * Every reminder has a stable `key`, so it is sent once (server log / device log) and a
 * changed due date or time makes a new reminder.
 */

export type ReminderKind = 'due_soon' | 'daily_nudge' | 'paused';

export interface ReminderPrefs {
  due_soon: boolean;
  due_soon_minutes: number;
  daily_nudge: boolean;
  daily_nudge_time: string;
  paused_reminder: boolean;
  quiet_hours_enabled: boolean;
  quiet_start: string;
  quiet_end: string;
}

export interface ReminderQuest {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  due_time: string | null;
  deleted_at: string | null;
}

export interface ReminderSession {
  id: string;
  quest_id: string | null;
  ended_at: string | null;
  deleted_at: string | null;
  pauses: { start: string; end: string | null }[];
}

export interface Reminder {
  key: string;
  kind: ReminderKind;
  /** When it fires (epoch ms). */
  at: number;
  questId: string | null;
  questTitle: string | null;
}

export interface ReminderInput {
  timezone: string;
  prefs: ReminderPrefs;
  quests: readonly ReminderQuest[];
  sessions: readonly ReminderSession[];
}

export const PAUSED_AFTER_MS = 15 * 60_000;
/** Date-only due quests are announced at this local time on their day. */
export const DUE_DAY_TIME = '09:00';

/* --------------------------------------------------------------- time zones */

function validZone(tz: string): string {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function parts(ms: number, tz: string) {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(tz, f);
  }
  const p: Record<string, number> = {};
  for (const x of f.formatToParts(new Date(ms)))
    if (x.type !== 'literal') p[x.type] = Number(x.value);
  return p as {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  };
}

/** Offset of `tz` from UTC at `ms`, in ms (Tehran: +3.5 h). */
function offset(ms: number, tz: string): number {
  const p = parts(ms, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** The instant of a local date and time in `tz` (DST-correct). */
export function zonedTime(date: string, time: string, tz: string): number {
  const zone = validZone(tz);
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const [hh, mm] = time.split(':').map(Number) as [number, number];
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = guess - offset(guess, zone);
  return guess - offset(first, zone);
}

/** Local date ("2026-03-10") and minutes after midnight of an instant in `tz`. */
export function localClock(ms: number, tz: string): { date: string; minutes: number } {
  const p = parts(ms, validZone(tz));
  const pad = (n: number) => String(n).padStart(2, '0');
  return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, minutes: p.hour * 60 + p.minute };
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/* -------------------------------------------------------------- quiet hours */

export function inQuietHours(ms: number, tz: string, prefs: ReminderPrefs): boolean {
  if (!prefs.quiet_hours_enabled) return false;
  const start = toMinutes(prefs.quiet_start);
  const end = toMinutes(prefs.quiet_end);
  if (start === end) return false;
  const m = localClock(ms, tz).minutes;
  return start < end ? m >= start && m < end : m >= start || m < end;
}

/** The first instant after `ms` when quiet hours end. */
export function quietHoursEnd(ms: number, tz: string, prefs: ReminderPrefs): number {
  const { date } = localClock(ms, tz);
  for (let i = 0; i < 3; i++) {
    const end = zonedTime(addDays(date, i), prefs.quiet_end, tz);
    if (end > ms) return end;
  }
  return ms;
}

/* ---------------------------------------------------------------- schedule */

const OPEN = new Set(['inbox', 'backlog', 'active']);

/**
 * Reminders that fire in (`from`, `to`]. A reminder that falls in quiet hours moves to the
 * end of quiet hours (due-soon only while the quest is not yet due; the daily nudge is
 * skipped that day).
 */
export function remindersBetween(input: ReminderInput, from: number, to: number): Reminder[] {
  const tz = validZone(input.timezone);
  const { prefs } = input;
  const out: Reminder[] = [];
  const push = (r: Reminder) => {
    if (r.at > from && r.at <= to) out.push(r);
  };

  if (prefs.due_soon) {
    for (const q of input.quests) {
      if (q.deleted_at || !q.due_date || !OPEN.has(q.status)) continue;
      const due = q.due_time ? zonedTime(q.due_date, q.due_time, tz) : null;
      let at =
        due !== null
          ? due - Math.max(0, prefs.due_soon_minutes) * 60_000
          : zonedTime(q.due_date, DUE_DAY_TIME, tz);
      if (inQuietHours(at, tz, prefs)) {
        at = quietHoursEnd(at, tz, prefs);
        if (due !== null && at >= due) continue;
        if (due === null && localClock(at, tz).date !== q.due_date) continue;
      }
      push({
        key: `due:${q.id}:${q.due_date}T${q.due_time ?? ''}`,
        kind: 'due_soon',
        at,
        questId: q.id,
        questTitle: q.title,
      });
    }
  }

  if (prefs.daily_nudge) {
    const first = localClock(from, tz).date;
    const last = localClock(to, tz).date;
    for (let day = addDays(first, -1); day <= last; day = addDays(day, 1)) {
      const at = zonedTime(day, prefs.daily_nudge_time, tz);
      if (inQuietHours(at, tz, prefs)) continue;
      push({ key: `nudge:${day}`, kind: 'daily_nudge', at, questId: null, questTitle: null });
    }
  }

  if (prefs.paused_reminder) {
    const titles = new Map(input.quests.map((q) => [q.id, q.title]));
    for (const s of input.sessions) {
      if (s.deleted_at || s.ended_at) continue;
      const open = s.pauses.find((p) => p.end === null);
      if (!open) continue;
      let at = Date.parse(open.start) + PAUSED_AFTER_MS;
      if (inQuietHours(at, tz, prefs)) at = quietHoursEnd(at, tz, prefs);
      push({
        key: `paused:${s.id}:${open.start}`,
        kind: 'paused',
        at,
        questId: s.quest_id,
        questTitle: s.quest_id ? (titles.get(s.quest_id) ?? null) : null,
      });
    }
  }

  return out.sort((a, b) => a.at - b.at);
}

/* -------------------------------------------------------------- push texts */

const TEXT = {
  en: {
    due_soon: (t: string | null) => ({
      title: 'Due soon',
      body: t ? `“${t}” is due soon. One small step is enough.` : 'A quest is due soon.',
    }),
    daily_nudge: () => ({
      title: 'Time to quest',
      body: 'Pick one tiny step. Starting is the win.',
    }),
    paused: (t: string | null) => ({
      title: 'Your quest is paused',
      body: t
        ? `“${t}” is waiting where you left it.`
        : 'Your focus session is waiting where you left it.',
    }),
  },
  fa: {
    due_soon: (t: string | null) => ({
      title: 'مهلت نزدیک است',
      body: t ? `مهلت «${t}» نزدیک است. یک قدم کوچک کافی است.` : 'مهلت یک ماموریت نزدیک است.',
    }),
    daily_nudge: () => ({
      title: 'وقت ماموریت است',
      body: 'یک قدم کوچک انتخاب کن. شروع کردن خودش برد است.',
    }),
    paused: (t: string | null) => ({
      title: 'ماموریتت مکث شده',
      body: t
        ? `«${t}» همان‌جایی که گذاشتی منتظر توست.`
        : 'جلسهٔ تمرکزت همان‌جایی که گذاشتی منتظر توست.',
    }),
  },
};

/** Notification text for web push (the app uses its own translations for in-app ones). */
export function reminderText(r: Reminder, lang: string): { title: string; body: string } {
  const t = lang === 'fa' ? TEXT.fa : TEXT.en;
  return t[r.kind](r.questTitle);
}

/** Where a notification click should lead. */
export function reminderUrl(r: Reminder): string {
  return r.kind === 'paused' ? '/focus' : r.questId ? `/quests/${r.questId}` : '/';
}
