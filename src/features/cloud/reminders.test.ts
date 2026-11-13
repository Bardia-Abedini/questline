import { describe, expect, it } from 'vitest';
import {
  inQuietHours,
  localClock,
  PAUSED_AFTER_MS,
  reminderText,
  remindersBetween,
  zonedTime,
  type ReminderInput,
  type ReminderPrefs,
} from '../../../supabase/functions/_shared/reminders.ts';

const prefs: ReminderPrefs = {
  due_soon: true,
  due_soon_minutes: 60,
  daily_nudge: false,
  daily_nudge_time: '09:00',
  paused_reminder: false,
  quiet_hours_enabled: false,
  quiet_start: '22:00',
  quiet_end: '08:00',
};

const quest = (over: Partial<ReminderInput['quests'][number]> = {}) => ({
  id: 'q1',
  title: 'Essay',
  status: 'active',
  due_date: '2026-03-10',
  due_time: '17:00',
  deleted_at: null,
  ...over,
});

const at = (iso: string) => Date.parse(iso);
const DAY = 86_400_000;

describe('time zones', () => {
  it('converts local wall times to instants, DST included', () => {
    expect(new Date(zonedTime('2026-03-10', '17:00', 'Asia/Tehran')).toISOString()).toBe(
      '2026-03-10T13:30:00.000Z',
    );
    // New York: EST before 8 March 2026, EDT after.
    expect(new Date(zonedTime('2026-03-07', '09:00', 'America/New_York')).toISOString()).toBe(
      '2026-03-07T14:00:00.000Z',
    );
    expect(new Date(zonedTime('2026-03-09', '09:00', 'America/New_York')).toISOString()).toBe(
      '2026-03-09T13:00:00.000Z',
    );
    expect(zonedTime('2026-03-10', '12:00', 'Not/AZone')).toBe(at('2026-03-10T12:00:00Z'));
    expect(localClock(at('2026-03-10T21:00:00Z'), 'Asia/Tehran')).toEqual({
      date: '2026-03-11',
      minutes: 30,
    });
  });
});

describe('reminders', () => {
  const tz = 'Asia/Tehran';
  const base: ReminderInput = { timezone: tz, prefs, quests: [quest()], sessions: [] };

  it('fires due-soon the chosen minutes before the due time, in the player zone', () => {
    const fire = zonedTime('2026-03-10', '16:00', tz);
    const found = remindersBetween(base, fire - 60_000, fire);
    expect(found).toEqual([
      {
        key: 'due:q1:2026-03-10T17:00',
        kind: 'due_soon',
        at: fire,
        questId: 'q1',
        questTitle: 'Essay',
      },
    ]);
    expect(remindersBetween(base, fire, fire + 60_000)).toEqual([]);
  });

  it('announces date-only quests at 09:00 on the day', () => {
    const input = { ...base, quests: [quest({ due_time: null })] };
    const [r] = remindersBetween(input, 0, at('2026-03-12T00:00:00Z'));
    expect(r!.at).toBe(zonedTime('2026-03-10', '09:00', tz));
    expect(r!.key).toBe('due:q1:2026-03-10T');
  });

  it('skips done, archived and deleted quests, and switched-off kinds', () => {
    const all = [0, at('2026-03-12T00:00:00Z')] as const;
    for (const q of [
      quest({ status: 'done' }),
      quest({ status: 'archived' }),
      quest({ deleted_at: '2026-03-01T00:00:00Z' }),
      quest({ due_date: null }),
    ]) {
      expect(remindersBetween({ ...base, quests: [q] }, ...all)).toEqual([]);
    }
    expect(remindersBetween({ ...base, prefs: { ...prefs, due_soon: false } }, ...all)).toEqual([]);
  });

  it('a changed due time makes a new reminder key', () => {
    const range = [0, at('2026-03-12T00:00:00Z')] as const;
    const a = remindersBetween(base, ...range)[0]!.key;
    const b = remindersBetween({ ...base, quests: [quest({ due_time: '18:00' })] }, ...range)[0]!
      .key;
    expect(a).not.toBe(b);
  });

  it('moves a due-soon reminder out of quiet hours, or drops it if the quest is due by then', () => {
    const quiet = { ...prefs, quiet_hours_enabled: true, due_soon_minutes: 120 };
    // Due 09:00 -> reminder 07:00 is quiet -> moves to 08:00.
    const morning = { ...base, prefs: quiet, quests: [quest({ due_time: '09:00' })] };
    const [r] = remindersBetween(morning, 0, at('2026-03-12T00:00:00Z'));
    expect(r!.at).toBe(zonedTime('2026-03-10', '08:00', tz));
    // Due 07:30 -> quiet until 08:00, after the due time -> dropped.
    const early = { ...morning, quests: [quest({ due_time: '07:30' })] };
    expect(remindersBetween(early, 0, at('2026-03-12T00:00:00Z'))).toEqual([]);
  });

  it('quiet hours work across midnight and same-day windows', () => {
    const quiet = { ...prefs, quiet_hours_enabled: true };
    expect(inQuietHours(zonedTime('2026-03-10', '23:30', tz), tz, quiet)).toBe(true);
    expect(inQuietHours(zonedTime('2026-03-10', '07:59', tz), tz, quiet)).toBe(true);
    expect(inQuietHours(zonedTime('2026-03-10', '08:00', tz), tz, quiet)).toBe(false);
    const nap = { ...quiet, quiet_start: '13:00', quiet_end: '14:00' };
    expect(inQuietHours(zonedTime('2026-03-10', '13:30', tz), tz, nap)).toBe(true);
    expect(inQuietHours(zonedTime('2026-03-10', '12:30', tz), tz, nap)).toBe(false);
  });

  it('nudges daily at the chosen time, never in quiet hours', () => {
    const nudge = { ...prefs, due_soon: false, daily_nudge: true, daily_nudge_time: '18:30' };
    const from = at('2026-03-10T00:00:00Z');
    const found = remindersBetween({ ...base, prefs: nudge }, from, from + 2 * DAY);
    expect(found.map((r) => r.key)).toEqual(['nudge:2026-03-10', 'nudge:2026-03-11']);
    expect(found[0]!.at).toBe(zonedTime('2026-03-10', '18:30', tz));
    const quietNudge = { ...nudge, daily_nudge_time: '23:00', quiet_hours_enabled: true };
    expect(remindersBetween({ ...base, prefs: quietNudge }, from, from + 2 * DAY)).toEqual([]);
  });

  it('reminds once about a paused session after 15 minutes', () => {
    const paused = { ...prefs, due_soon: false, paused_reminder: true };
    const session = {
      id: 's1',
      quest_id: 'q1',
      ended_at: null,
      deleted_at: null,
      pauses: [
        { start: '2026-03-10T08:00:00.000Z', end: '2026-03-10T08:05:00.000Z' },
        { start: '2026-03-10T09:00:00.000Z', end: null },
      ],
    };
    const input = { ...base, prefs: paused, sessions: [session] };
    const fire = at('2026-03-10T09:00:00Z') + PAUSED_AFTER_MS;
    expect(remindersBetween(input, fire - 1000, fire)).toMatchObject([
      { kind: 'paused', key: 'paused:s1:2026-03-10T09:00:00.000Z', questTitle: 'Essay' },
    ]);
    const ended = { ...session, ended_at: '2026-03-10T09:10:00Z' };
    expect(remindersBetween({ ...input, sessions: [ended] }, 0, fire + DAY)).toEqual([]);
  });

  it('writes push texts in the player language', () => {
    const [r] = remindersBetween(base, 0, at('2026-03-12T00:00:00Z'));
    expect(reminderText(r!, 'en').body).toContain('“Essay”');
    expect(reminderText(r!, 'fa').title).toBe('مهلت نزدیک است');
  });
});
