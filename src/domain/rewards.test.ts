import { describe, expect, it } from 'vitest';
import {
  BASE_REWARDS,
  bossExtra,
  finishBonus,
  focusBonusXp,
  multiplyXp,
  questRewardPlan,
  stepPayout,
  stepPool,
} from './rewards';
import { DIFFICULTIES, addRewards } from './types';

describe('BASE_REWARDS', () => {
  it('matches the plan table', () => {
    expect(BASE_REWARDS).toEqual({
      E: { xp: 20, gold: 10 },
      D: { xp: 40, gold: 20 },
      C: { xp: 80, gold: 40 },
      B: { xp: 150, gold: 75 },
      A: { xp: 300, gold: 150 },
      S: { xp: 600, gold: 300 },
    });
  });
});

describe('60/40 split', () => {
  it.each(DIFFICULTIES)('step pool + finish bonus equals the base reward for %s', (d) => {
    const total = addRewards(stepPool(d), finishBonus(d));
    expect(total).toEqual(BASE_REWARDS[d]);
  });

  it('pays 60% across steps and 40% on finish', () => {
    expect(stepPool('S')).toEqual({ xp: 360, gold: 180 });
    expect(finishBonus('S')).toEqual({ xp: 240, gold: 120 });
    expect(stepPool('E')).toEqual({ xp: 12, gold: 6 });
    expect(finishBonus('E')).toEqual({ xp: 8, gold: 4 });
  });

  it('rounds the 60% share to whole points (B gold 75 -> 45 / 30)', () => {
    expect(stepPool('B')).toEqual({ xp: 90, gold: 45 });
    expect(finishBonus('B')).toEqual({ xp: 60, gold: 30 });
  });
});

describe('questRewardPlan', () => {
  it('splits evenly with the remainder on the last step', () => {
    const plan = questRewardPlan('E', 5); // pool 12 xp, 6 gold
    expect(plan.steps.map((s) => s.xp)).toEqual([2, 2, 2, 2, 4]);
    expect(plan.steps.map((s) => s.gold)).toEqual([1, 1, 1, 1, 2]);
    expect(plan.finish).toEqual({ xp: 8, gold: 4 });
    expect(plan.total).toEqual(BASE_REWARDS.E);
  });

  it('gives a single step the whole pool', () => {
    const plan = questRewardPlan('C', 1);
    expect(plan.steps).toEqual([{ xp: 48, gold: 24 }]);
  });

  it('treats zero or negative step counts as one step', () => {
    expect(questRewardPlan('D', 0).steps).toHaveLength(1);
    expect(questRewardPlan('D', -3).steps).toHaveLength(1);
  });

  it.each(DIFFICULTIES)('always adds up to the base reward for %s with 1..12 steps', (d) => {
    for (let n = 1; n <= 12; n++) {
      const plan = questRewardPlan(d, n);
      expect(addRewards(...plan.steps, plan.finish)).toEqual(BASE_REWARDS[d]);
      // Every step except the last pays the same amount; the last pays at least that.
      const first = plan.steps[0]!;
      for (const s of plan.steps.slice(0, -1)) expect(s).toEqual(first);
      expect(plan.steps.at(-1)!.xp).toBeGreaterThanOrEqual(first.xp);
    }
  });

  it('more steps than points pays zero on early steps and everything on the last', () => {
    const plan = questRewardPlan('E', 20); // 12 xp over 20 steps
    expect(plan.steps.slice(0, 19).every((s) => s.xp === 0)).toBe(true);
    expect(plan.steps[19]!.xp).toBe(12);
  });

  it('adds the boss bonus to the finish only', () => {
    const plan = questRewardPlan('S', 3, { boss: true });
    expect(plan.finish).toEqual({ xp: 300, gold: 150 });
    expect(addRewards(...plan.steps)).toEqual(stepPool('S'));
  });
});

describe('stepPayout (dynamic, ledger based)', () => {
  const none = { xp: 0, gold: 0 };

  it('pays pool / step count, rounded down', () => {
    expect(
      stepPayout({ difficulty: 'C', totalSteps: 4, remainingSteps: 4, paidSoFar: none }),
    ).toEqual({
      xp: 12,
      gold: 6,
    });
    expect(
      stepPayout({
        difficulty: 'E',
        totalSteps: 5,
        remainingSteps: 3,
        paidSoFar: { xp: 4, gold: 2 },
      }),
    ).toEqual({
      xp: 2,
      gold: 1,
    });
  });

  it('the last unpaid step takes the remainder', () => {
    expect(
      stepPayout({
        difficulty: 'E',
        totalSteps: 5,
        remainingSteps: 1,
        paidSoFar: { xp: 8, gold: 4 },
      }),
    ).toEqual({
      xp: 4,
      gold: 2,
    });
  });

  it('keeps the total exact when steps are added midway', () => {
    // C pool: 48 xp / 24 gold. Three steps; one is paid, then the player adds two more.
    let paid = none;
    const plan = [
      { total: 3, remaining: 3 },
      { total: 5, remaining: 4 },
      { total: 5, remaining: 3 },
      { total: 5, remaining: 2 },
      { total: 5, remaining: 1 },
    ];
    const pays = plan.map(({ total, remaining }) => {
      const p = stepPayout({
        difficulty: 'C',
        totalSteps: total,
        remainingSteps: remaining,
        paidSoFar: paid,
      });
      paid = addRewards(paid, p);
      return p;
    });
    expect(paid).toEqual(stepPool('C'));
    expect(pays[0]).toEqual({ xp: 16, gold: 8 });
    expect(pays[1]).toEqual({ xp: 9, gold: 4 });
  });

  it('keeps the total exact when steps are removed midway', () => {
    let paid = none;
    for (const [total, remaining] of [
      [6, 6],
      [2, 1],
    ] as const) {
      paid = addRewards(
        paid,
        stepPayout({
          difficulty: 'A',
          totalSteps: total,
          remainingSteps: remaining,
          paidSoFar: paid,
        }),
      );
    }
    expect(paid).toEqual(stepPool('A'));
  });

  it('never pays more than what is left of the pool', () => {
    // Paid 40 of 48 at 4 steps, then steps removed so the unit grows to 24.
    expect(
      stepPayout({
        difficulty: 'C',
        totalSteps: 2,
        remainingSteps: 2,
        paidSoFar: { xp: 40, gold: 20 },
      }),
    ).toEqual({ xp: 8, gold: 4 });
  });

  it('never pays a negative amount, even if the ledger already holds more', () => {
    expect(
      stepPayout({
        difficulty: 'E',
        totalSteps: 1,
        remainingSteps: 1,
        paidSoFar: { xp: 999, gold: 999 },
      }),
    ).toEqual({ xp: 0, gold: 0 });
  });

  it('treats remainingSteps below 1 as the last step and totalSteps below 1 as 1', () => {
    expect(
      stepPayout({
        difficulty: 'E',
        totalSteps: 3,
        remainingSteps: 0,
        paidSoFar: { xp: 4, gold: 2 },
      }),
    ).toEqual({
      xp: 8,
      gold: 4,
    });
    expect(
      stepPayout({ difficulty: 'E', totalSteps: 0, remainingSteps: 2, paidSoFar: none }),
    ).toEqual(stepPool('E'));
  });

  it('ignores negative paidSoFar values', () => {
    expect(
      stepPayout({
        difficulty: 'E',
        totalSteps: 1,
        remainingSteps: 1,
        paidSoFar: { xp: -10, gold: -10 },
      }),
    ).toEqual(stepPool('E'));
  });
});

describe('boss bonus', () => {
  it.each([
    ['E', { xp: 10, gold: 5 }],
    ['D', { xp: 20, gold: 10 }],
    ['C', { xp: 40, gold: 20 }],
    ['B', { xp: 75, gold: 38 }],
    ['A', { xp: 150, gold: 75 }],
    ['S', { xp: 300, gold: 150 }],
  ] as const)('raises the %s finish bonus by 25%%', (d, expected) => {
    expect(finishBonus(d, { boss: true })).toEqual(expected);
  });

  it('bossExtra is the difference to the normal finish', () => {
    expect(bossExtra('S')).toEqual({ xp: 60, gold: 30 });
    expect(bossExtra('B')).toEqual({ xp: 15, gold: 8 });
  });
});

describe('focusBonusXp', () => {
  const min = 60_000;
  it.each([
    [0, 0],
    [4 * min + 59_999, 0],
    [5 * min, 1],
    [9 * min, 1],
    [10 * min, 2],
    [25 * min, 5],
    [45 * min, 9],
    [-5 * min, 0],
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0],
  ])('%d ms -> %d XP', (ms, xp) => {
    expect(focusBonusXp(ms)).toBe(xp);
  });
});

describe('multiplyXp', () => {
  it('doubles XP and leaves gold alone', () => {
    expect(multiplyXp({ xp: 7, gold: 3 }, 2)).toEqual({ xp: 14, gold: 3 });
  });
  it('rounds to whole points', () => {
    expect(multiplyXp({ xp: 5, gold: 0 }, 1.5)).toEqual({ xp: 8, gold: 0 });
  });
});
