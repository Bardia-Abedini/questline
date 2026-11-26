import { describe, expect, it } from 'vitest';
import {
  DAILY_QUEST_POOL,
  dailyQuestProgress,
  EMPTY_DAY_ACTIVITY,
  generateDailyQuests,
  rerollDailyQuest,
  type DailyQuestDef,
} from './dailyQuests';
import { createRng } from './rng';

describe('DAILY_QUEST_POOL', () => {
  it('has unique keys and small positive rewards', () => {
    const keys = DAILY_QUEST_POOL.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const d of DAILY_QUEST_POOL) {
      expect(d.rewardGold).toBeGreaterThan(0);
      expect(d.rewardGold).toBeLessThanOrEqual(20);
      expect(d.target).toBeGreaterThan(0);
    }
  });
});

describe('generateDailyQuests', () => {
  it('gives three goals of different kinds', () => {
    const set = generateDailyQuests('2026-03-10', 'player-1');
    expect(set).toHaveLength(3);
    expect(new Set(set.map((d) => d.kind)).size).toBe(3);
  });

  it('is the same for the same seed and day (all devices agree)', () => {
    expect(generateDailyQuests('2026-03-10', 'p')).toEqual(generateDailyQuests('2026-03-10', 'p'));
  });

  it('varies between days and players', () => {
    const days = new Set<string>();
    for (let i = 1; i <= 28; i++) {
      const day = `2026-02-${String(i).padStart(2, '0')}`;
      days.add(
        generateDailyQuests(day, 'p')
          .map((d) => d.key)
          .join(),
      );
    }
    expect(days.size).toBeGreaterThan(10);
    const a = generateDailyQuests('2026-03-10', 'alice').map((d) => d.key);
    const b = generateDailyQuests('2026-03-10', 'bob').map((d) => d.key);
    const c = generateDailyQuests('2026-03-10', 'carol').map((d) => d.key);
    expect(new Set([a.join(), b.join(), c.join()]).size).toBeGreaterThan(1);
  });

  it('returns fewer goals when the pool has fewer kinds', () => {
    const pool: DailyQuestDef[] = [
      { key: 'a', kind: 'finish_steps', target: 1, rewardGold: 1 },
      { key: 'b', kind: 'finish_steps', target: 2, rewardGold: 1 },
    ];
    expect(generateDailyQuests('2026-03-10', 'p', pool)).toHaveLength(1);
    expect(generateDailyQuests('2026-03-10', 'p', [])).toEqual([]);
  });

  it('respects a custom count', () => {
    expect(generateDailyQuests('2026-03-10', 'p', DAILY_QUEST_POOL, 5)).toHaveLength(5);
  });
});

describe('rerollDailyQuest', () => {
  const current = generateDailyQuests('2026-03-10', 'p');

  it('replaces one goal with a new kind and keeps the others', () => {
    const next = rerollDailyQuest(current, 1, createRng(3));
    expect(next[0]).toEqual(current[0]);
    expect(next[2]).toEqual(current[2]);
    expect(current.map((d) => d.kind)).not.toContain(next[1]!.kind);
    expect(new Set(next.map((d) => d.kind)).size).toBe(3);
  });

  it('does nothing for an index out of range', () => {
    expect(rerollDailyQuest(current, 7, createRng(1))).toEqual(current);
    expect(rerollDailyQuest(current, -1, createRng(1))).toEqual(current);
  });

  it('keeps the goal when nothing else is available', () => {
    const only: DailyQuestDef[] = [{ key: 'a', kind: 'finish_steps', target: 1, rewardGold: 1 }];
    expect(rerollDailyQuest(only, 0, createRng(1), only)).toEqual(only);
  });

  it('does not mutate the input', () => {
    const copy = current.slice();
    rerollDailyQuest(current, 0, createRng(9));
    expect(current).toEqual(copy);
  });
});

describe('dailyQuestProgress', () => {
  const def: DailyQuestDef = { key: 'focus_25', kind: 'focus_minutes', target: 25, rewardGold: 10 };
  it('counts toward the target and caps progress', () => {
    expect(dailyQuestProgress(def, { ...EMPTY_DAY_ACTIVITY, focusMinutes: 10 })).toEqual({
      progress: 10,
      target: 25,
      done: false,
    });
    expect(dailyQuestProgress(def, { ...EMPTY_DAY_ACTIVITY, focusMinutes: 40 })).toEqual({
      progress: 25,
      target: 25,
      done: true,
    });
  });
  it('maps every kind to its activity field', () => {
    for (const d of DAILY_QUEST_POOL) {
      expect(dailyQuestProgress(d, EMPTY_DAY_ACTIVITY).done).toBe(false);
      const full = Object.fromEntries(Object.keys(EMPTY_DAY_ACTIVITY).map((k) => [k, 1000]));
      expect(dailyQuestProgress(d, full as never).done).toBe(true);
    }
  });
  it('treats negative counts as zero', () => {
    expect(dailyQuestProgress(def, { ...EMPTY_DAY_ACTIVITY, focusMinutes: -3 }).progress).toBe(0);
  });
});
