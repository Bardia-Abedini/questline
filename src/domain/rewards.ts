import { MINUTE_MS } from './dates';
import type { Difficulty, Reward } from './types';

/** Base reward for finishing a whole quest of each difficulty (plan section 6). */
export const BASE_REWARDS: Readonly<Record<Difficulty, Reward>> = Object.freeze({
  E: { xp: 20, gold: 10 },
  D: { xp: 40, gold: 20 },
  C: { xp: 80, gold: 40 },
  B: { xp: 150, gold: 75 },
  A: { xp: 300, gold: 150 },
  S: { xp: 600, gold: 300 },
});

/** Share of the base reward paid across steps as they are done. */
export const STEP_SHARE_PERCENT = 60;
/** Boss quests pay this multiple of the normal finish bonus (+25%). */
export const BOSS_FINISH_MULTIPLIER = 1.25;
/** Focus bonus: +1 XP for every this many focused minutes in a timed session. */
export const FOCUS_BONUS_MINUTES_PER_XP = 5;

function split(total: number): { stepPool: number; finish: number } {
  const stepPool = Math.round((total * STEP_SHARE_PERCENT) / 100);
  return { stepPool, finish: total - stepPool };
}

/** The 60% of the base reward that is paid across the steps. */
export function stepPool(difficulty: Difficulty): Reward {
  const base = BASE_REWARDS[difficulty];
  return { xp: split(base.xp).stepPool, gold: split(base.gold).stepPool };
}

/**
 * The finish bonus (the remaining 40%), raised by 25% for boss quests.
 * The boss bonus is rounded to whole points.
 */
export function finishBonus(difficulty: Difficulty, options: { boss?: boolean } = {}): Reward {
  const base = BASE_REWARDS[difficulty];
  const xp = split(base.xp).finish;
  const gold = split(base.gold).finish;
  if (!options.boss) return { xp, gold };
  return {
    xp: Math.round(xp * BOSS_FINISH_MULTIPLIER),
    gold: Math.round(gold * BOSS_FINISH_MULTIPLIER),
  };
}

/** The part of a boss finish bonus that is above the normal finish bonus. */
export function bossExtra(difficulty: Difficulty): Reward {
  const normal = finishBonus(difficulty);
  const boss = finishBonus(difficulty, { boss: true });
  return { xp: boss.xp - normal.xp, gold: boss.gold - normal.gold };
}

/**
 * Static plan of how a quest with `stepCount` steps pays out when the steps are done in order:
 * the step pool split evenly, with the rounding remainder on the last step.
 */
export function questRewardPlan(
  difficulty: Difficulty,
  stepCount: number,
  options: { boss?: boolean } = {},
): { steps: Reward[]; finish: Reward; total: Reward } {
  const count = Math.max(1, Math.floor(stepCount));
  const steps: Reward[] = [];
  let paid: Reward = { xp: 0, gold: 0 };
  for (let i = 0; i < count; i++) {
    const r = stepPayout({
      difficulty,
      totalSteps: count,
      remainingSteps: count - i,
      paidSoFar: paid,
    });
    steps.push(r);
    paid = { xp: paid.xp + r.xp, gold: paid.gold + r.gold };
  }
  const finish = finishBonus(difficulty, options);
  return { steps, finish, total: { xp: paid.xp + finish.xp, gold: paid.gold + finish.gold } };
}

export interface StepPayoutInput {
  difficulty: Difficulty;
  /** How many steps the quest has right now (done or not). */
  totalSteps: number;
  /**
   * Steps not yet paid, counting the one being completed now (so at least 1).
   * When this is 1, the step is the last one and takes whatever is left of the pool.
   */
  remainingSteps: number;
  /** What the quest's earlier step completions already paid (from the ledger). */
  paidSoFar: Reward;
}

/**
 * What completing one step pays: the step pool divided evenly by the quest's step count
 * (rounded down), with the rounding remainder on the last unpaid step. Because the last
 * step takes "whatever is left", a quest's steps always add up to exactly 60% of its base
 * reward, even when steps are added or removed midway. Never negative, never more than
 * what is left of the pool.
 */
export function stepPayout({
  difficulty,
  totalSteps,
  remainingSteps,
  paidSoFar,
}: StepPayoutInput): Reward {
  const pool = stepPool(difficulty);
  const total = Math.max(1, Math.floor(totalSteps));
  const leftXp = Math.max(0, pool.xp - Math.max(0, paidSoFar.xp));
  const leftGold = Math.max(0, pool.gold - Math.max(0, paidSoFar.gold));
  if (Math.floor(remainingSteps) <= 1) return { xp: leftXp, gold: leftGold };
  return {
    xp: Math.min(leftXp, Math.floor(pool.xp / total)),
    gold: Math.min(leftGold, Math.floor(pool.gold / total)),
  };
}

/** Focus bonus XP for a timed session: +1 XP per full 5 focused minutes. */
export function focusBonusXp(focusedMs: number): number {
  if (!Number.isFinite(focusedMs) || focusedMs <= 0) return 0;
  return Math.floor(focusedMs / (FOCUS_BONUS_MINUTES_PER_XP * MINUTE_MS));
}

/** Applies an XP multiplier (e.g. a double-XP potion) to a reward. Gold is untouched. */
export function multiplyXp(reward: Reward, multiplier: number): Reward {
  return { xp: Math.round(reward.xp * multiplier), gold: reward.gold };
}
