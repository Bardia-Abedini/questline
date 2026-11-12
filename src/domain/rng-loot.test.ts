import { describe, expect, it } from 'vitest';
import {
  anyLuckyCharmActive,
  isLuckyCharmActive,
  LUCKY_CHARM_DURATION_MS,
  luckyCharmEndsAt,
  RARE_DROP_CHANCE,
  rollQuestLoot,
  rollStepLoot,
  STEP_LOOT_CHANCE,
  STEP_LOOT_GOLD,
  stepLootChance,
} from './loot';
import { chance, createRng, pick, randomInt, seedFromString, sequenceRng, shuffle } from './rng';
import { DIFFICULTIES } from './types';

describe('createRng', () => {
  it('is deterministic for a seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const xs = Array.from({ length: 20 }, () => a.next());
    const ys = Array.from({ length: 20 }, () => b.next());
    expect(xs).toEqual(ys);
  });
  it('differs between seeds and stays in [0, 1)', () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a.next()).not.toBe(b.next());
    const r = createRng(7);
    for (let i = 0; i < 10_000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('is roughly uniform', () => {
    const r = createRng(123);
    const buckets = new Array(10).fill(0);
    for (let i = 0; i < 20_000; i++) buckets[Math.floor(r.next() * 10)]++;
    for (const b of buckets) expect(b).toBeGreaterThan(1700);
  });
});

describe('seedFromString', () => {
  it('is stable and spreads inputs', () => {
    expect(seedFromString('abc')).toBe(seedFromString('abc'));
    expect(seedFromString('abc')).not.toBe(seedFromString('abd'));
    expect(seedFromString('')).toBe(0x811c9dc5);
  });
});

describe('helpers', () => {
  it('sequenceRng loops and rejects empty input', () => {
    const r = sequenceRng([0.1, 0.9]);
    expect([r.next(), r.next(), r.next()]).toEqual([0.1, 0.9, 0.1]);
    expect(() => sequenceRng([])).toThrow();
  });
  it('chance handles the edges without drawing', () => {
    const r = sequenceRng([0.5]);
    expect(chance(r, 0)).toBe(false);
    expect(chance(r, 1)).toBe(true);
    expect(chance(sequenceRng([0.49]), 0.5)).toBe(true);
    expect(chance(sequenceRng([0.5]), 0.5)).toBe(false);
  });
  it('randomInt covers both ends and accepts swapped bounds', () => {
    expect(randomInt(sequenceRng([0]), 3, 8)).toBe(3);
    expect(randomInt(sequenceRng([0.9999]), 3, 8)).toBe(8);
    expect(randomInt(sequenceRng([0]), 8, 3)).toBe(3);
  });
  it('pick and shuffle', () => {
    expect(pick(sequenceRng([0.99]), ['a', 'b', 'c'])).toBe('c');
    expect(() => pick(sequenceRng([0]), [])).toThrow();
    const items = [1, 2, 3, 4, 5, 6];
    const out = shuffle(createRng(5), items);
    expect(out.slice().sort()).toEqual(items);
    expect(items).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('rollStepLoot', () => {
  it('drops nothing above the chance', () => {
    expect(rollStepLoot(sequenceRng([STEP_LOOT_CHANCE]), 'C')).toEqual({ bonusGold: 0 });
  });
  it.each(DIFFICULTIES)('drops gold in range for %s', (d) => {
    const [min, max] = STEP_LOOT_GOLD[d];
    expect(rollStepLoot(sequenceRng([0, 0]), d).bonusGold).toBe(min);
    expect(rollStepLoot(sequenceRng([0, 0.99999]), d).bonusGold).toBe(max);
  });
  it('drops about 15% of the time', () => {
    const r = createRng(99);
    let drops = 0;
    const n = 20_000;
    for (let i = 0; i < n; i++) if (rollStepLoot(r, 'E').bonusGold > 0) drops++;
    expect(drops / n).toBeGreaterThan(0.13);
    expect(drops / n).toBeLessThan(0.17);
  });
});

describe('lucky charm', () => {
  const T = 1_700_000_000_000;
  it('lasts exactly 24 hours from activation', () => {
    expect(LUCKY_CHARM_DURATION_MS).toBe(24 * 60 * 60 * 1000);
    expect(isLuckyCharmActive(T, T)).toBe(true);
    expect(isLuckyCharmActive(T, T + LUCKY_CHARM_DURATION_MS - 1)).toBe(true);
    expect(isLuckyCharmActive(T, T + LUCKY_CHARM_DURATION_MS)).toBe(false);
    expect(isLuckyCharmActive(T, T - 1)).toBe(false);
    expect(luckyCharmEndsAt(T)).toBe(T + LUCKY_CHARM_DURATION_MS);
  });
  it('any active charm counts', () => {
    expect(anyLuckyCharmActive([], T)).toBe(false);
    expect(anyLuckyCharmActive([T - 2 * LUCKY_CHARM_DURATION_MS, T - 1000], T)).toBe(true);
    expect(anyLuckyCharmActive([T - 2 * LUCKY_CHARM_DURATION_MS], T)).toBe(false);
  });
  it('doubles the step loot chance', () => {
    expect(stepLootChance()).toBe(0.15);
    expect(stepLootChance({ luckyCharm: true })).toBe(0.3);
    // A roll of 0.2 misses without the charm and hits with it.
    expect(rollStepLoot(sequenceRng([0.2, 0]), 'C').bonusGold).toBe(0);
    expect(rollStepLoot(sequenceRng([0.2, 0]), 'C', { luckyCharm: true }).bonusGold).toBe(3);
  });
  it('drops about 30% of the time with a charm', () => {
    const r = createRng(42);
    let drops = 0;
    const n = 20_000;
    for (let i = 0; i < n; i++)
      if (rollStepLoot(r, 'E', { luckyCharm: true }).bonusGold > 0) drops++;
    expect(drops / n).toBeGreaterThan(0.28);
    expect(drops / n).toBeLessThan(0.32);
  });
});

describe('rollQuestLoot', () => {
  const items = ['hat_star', 'pet_fox', 'lamp_moon'];
  it('usually drops nothing', () => {
    expect(rollQuestLoot(sequenceRng([0.5]), 'S', items)).toEqual({ rareItemId: null });
  });
  it('drops one of the candidates under the chance', () => {
    expect(rollQuestLoot(sequenceRng([0, 0.5]), 'E', items)).toEqual({ rareItemId: 'pet_fox' });
  });
  it('skips owned items and returns null when all are owned', () => {
    expect(rollQuestLoot(sequenceRng([0, 0]), 'E', items, new Set(['hat_star']))).toEqual({
      rareItemId: 'pet_fox',
    });
    expect(rollQuestLoot(sequenceRng([0, 0]), 'E', items, new Set(items))).toEqual({
      rareItemId: null,
    });
    expect(rollQuestLoot(sequenceRng([0, 0]), 'E', [])).toEqual({ rareItemId: null });
  });
  it('rare chances are small and grow with difficulty', () => {
    const values = DIFFICULTIES.map((d) => RARE_DROP_CHANCE[d]);
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(Math.max(...values)).toBeLessThanOrEqual(0.1);
  });
});
