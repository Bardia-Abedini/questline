import { describe, expect, it } from 'vitest';
import {
  computeStats,
  computeWeeklyRecap,
  dayPartOf,
  recapOfferOpen,
  type StatsInput,
} from './compute';

// Tests run in UTC (vite.config test env), so local hours equal UTC hours.
const TODAY = '2026-03-11'; // a Wednesday

function session(start: string, minutes: number, distractions: string[] = []) {
  const startMs = Date.parse(start);
  return {
    kind: 'focus' as const,
    started_at: start,
    ended_at: new Date(startMs + minutes * 60_000).toISOString(),
    focused_ms: minutes * 60_000,
    distractions: distractions.map((at) => ({ at, kind: 'button' as const, note_id: null })),
    deleted_at: null,
  };
}

function base(over: Partial<StatsInput> = {}): StatsInput {
  return {
    today: TODAY,
    weekStartsOn: 1,
    sessions: [],
    steps: [],
    quests: [],
    ledger: [],
    achievements: [],
    ...over,
  };
}

describe('dayPartOf', () => {
  it('splits the day into six parts', () => {
    expect([4, 5, 9, 12, 15, 18, 22].map(dayPartOf)).toEqual([
      'night',
      'early',
      'morning',
      'midday',
      'afternoon',
      'evening',
      'night',
    ]);
  });
});

describe('computeStats', () => {
  const input = base({
    sessions: [
      session('2026-03-11T09:30:00Z', 25, ['2026-03-11T09:40:00Z']),
      session('2026-03-10T15:00:00Z', 10, ['2026-03-10T15:05:00Z', '2026-03-10T15:06:00Z']),
      session('2026-03-01T10:00:00Z', 45), // outside 7 days
      { ...session('2026-03-11T11:00:00Z', 5), kind: 'break' as const },
    ],
    steps: [
      {
        quest_id: 'q1',
        done_at: '2026-03-11T09:55:00Z',
        guess_minutes: 20,
        actual_ms: 25 * 60_000,
        deleted_at: null,
      },
      {
        quest_id: 'q1',
        done_at: '2026-03-10T15:10:00Z',
        guess_minutes: 10,
        actual_ms: 10 * 60_000,
        deleted_at: null,
      },
      { quest_id: 'q2', done_at: null, guess_minutes: 5, actual_ms: 0, deleted_at: null },
    ],
    quests: [
      {
        id: 'q1',
        title: 'Essay',
        status: 'done',
        completed_at: '2026-03-11T09:55:00Z',
        guess_minutes: null,
        category_id: null,
        deleted_at: null,
      },
    ],
    ledger: [
      { kind: 'step_reward', xp: 50, day: '2026-03-01', deleted_at: null },
      { kind: 'step_reward', xp: 20, day: '2026-03-10', deleted_at: null },
      { kind: 'quest_finish', xp: 30, day: '2026-03-11', deleted_at: null },
      { kind: 'purchase', xp: 0, day: '2026-03-11', deleted_at: null },
    ],
  });

  it('counts focus, steps and quests inside the range only', () => {
    const s = computeStats(input, '7d');
    expect(s.buckets).toHaveLength(7);
    expect(s.from).toBe('2026-03-05');
    expect(s.totals).toMatchObject({
      focusMs: 35 * 60_000,
      sessions: 2,
      steps: 2,
      quests: 1,
      xp: 50,
    });
    expect(s.activeDays).toBe(2);
    expect(s.streak).toBe(2);
    expect(s.bestDay).toBe('2026-03-11');
    expect(s.bestPart).toBe('morning');
  });

  it('keeps lifetime XP climbing across buckets', () => {
    const s = computeStats(input, '7d');
    expect(s.buckets[0]!.xpTotal).toBe(50);
    expect(s.buckets.at(-1)!.xpTotal).toBe(100);
  });

  it('finds when distractions cluster, by part of day and weekday', () => {
    const s = computeStats(input, '7d');
    expect(s.distractions.total).toBe(3);
    expect(s.distractions.topPart).toBe('afternoon');
    expect(s.distractions.topWeekday).toBe(2); // Tuesday
    expect(s.distractions.weekdays[0]).toBe(1); // week starts Monday
  });

  it('compares guesses with real time', () => {
    const s = computeStats(input, '30d');
    expect(s.estimates.recent).toEqual([
      { title: 'Essay', guessMinutes: 30, actualMinutes: 35, completedDay: '2026-03-11' },
    ]);
    expect(s.estimates.ratios.overall).toBeNull(); // fewer than 3 samples
  });

  it('"all" starts at the first data day and buckets long spans by week', () => {
    expect(computeStats(input, 'all').from).toBe('2026-03-01');
    const long = computeStats(
      base({ ledger: [{ kind: 'step_reward', xp: 10, day: '2025-10-01', deleted_at: null }] }),
      'all',
    );
    expect(long.unit).toBe('week');
    expect(long.buckets[0]!.start).toBe('2025-09-29');
  });

  it('is empty but valid with no data', () => {
    const s = computeStats(base(), '7d');
    expect(s.totals.focusMs).toBe(0);
    expect(s.bestPart).toBeNull();
    expect(s.bestDay).toBeNull();
  });
});

describe('computeWeeklyRecap', () => {
  it('summarises last week with wins only', () => {
    const r = computeWeeklyRecap(
      base({
        sessions: [session('2026-03-03T10:00:00Z', 30), session('2026-03-11T10:00:00Z', 30)],
        steps: [
          {
            quest_id: 'q',
            done_at: '2026-03-03T10:30:00Z',
            guess_minutes: 5,
            actual_ms: 0,
            deleted_at: null,
          },
        ],
        ledger: [
          { kind: 'step_reward', xp: 90, day: '2026-02-20', deleted_at: null },
          { kind: 'step_reward', xp: 20, day: '2026-03-03', deleted_at: null },
        ],
        achievements: [{ unlocked_at: '2026-03-04T08:00:00Z', deleted_at: null }],
      }),
    );
    expect(r).toMatchObject({
      weekStart: '2026-03-02',
      weekEnd: '2026-03-08',
      focusMs: 30 * 60_000,
      steps: 1,
      quests: 0,
      bestDay: '2026-03-03',
      levels: [2],
      badges: 1,
      hasWins: true,
    });
  });

  it('has no wins for an empty week, so nothing is shown', () => {
    expect(computeWeeklyRecap(base()).hasWins).toBe(false);
  });

  it('is offered during the first three days of the week', () => {
    expect(recapOfferOpen('2026-03-09', 1)).toBe(true); // Monday
    expect(recapOfferOpen('2026-03-11', 1)).toBe(true); // Wednesday
    expect(recapOfferOpen('2026-03-12', 1)).toBe(false);
  });
});
