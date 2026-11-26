import { HOUR_MS, type EpochMs } from './dates';
import { chance, pick, randomInt, type Rng } from './rng';
import type { Difficulty } from './types';

/** Chance of bonus gold when a step is completed (plan: about 15%). */
export const STEP_LOOT_CHANCE = 0.15;

/** Bonus gold range for a step loot drop, by quest difficulty. */
export const STEP_LOOT_GOLD: Readonly<Record<Difficulty, readonly [number, number]>> =
  Object.freeze({
    E: [2, 5],
    D: [2, 6],
    C: [3, 8],
    B: [4, 10],
    A: [5, 12],
    S: [6, 15],
  });

/** Chance of a rare cosmetic when a quest is finished ("small chance"), by difficulty. */
export const RARE_DROP_CHANCE: Readonly<Record<Difficulty, number>> = Object.freeze({
  E: 0.02,
  D: 0.025,
  C: 0.03,
  B: 0.04,
  A: 0.05,
  S: 0.08,
});

/** Lucky charm power-up: multiplies the step loot chance for 24 hours after activation. */
export const LUCKY_CHARM_DURATION_MS = 24 * HOUR_MS;
export const LUCKY_CHARM_CHANCE_MULTIPLIER = 2;

/** Whether a lucky charm activated at `activatedAt` is still working at `now`. */
export function isLuckyCharmActive(activatedAt: EpochMs, now: EpochMs): boolean {
  return now >= activatedAt && now < activatedAt + LUCKY_CHARM_DURATION_MS;
}

/** Whether any of these charm activations is working at `now`. */
export function anyLuckyCharmActive(activations: readonly EpochMs[], now: EpochMs): boolean {
  return activations.some((a) => isLuckyCharmActive(a, now));
}

/** When a lucky charm activated at `activatedAt` stops working. */
export function luckyCharmEndsAt(activatedAt: EpochMs): EpochMs {
  return activatedAt + LUCKY_CHARM_DURATION_MS;
}

/** Bonus-gold chance on a step: 15%, doubled to 30% while a lucky charm is active. */
export function stepLootChance(options: { luckyCharm?: boolean } = {}): number {
  return Math.min(1, STEP_LOOT_CHANCE * (options.luckyCharm ? LUCKY_CHARM_CHANCE_MULTIPLIER : 1));
}

/**
 * Rolls loot for a completed step. Returns the bonus gold (0 when nothing dropped).
 * Uses exactly two rng draws when it drops, one when it does not.
 */
export function rollStepLoot(
  rng: Rng,
  difficulty: Difficulty,
  options: { luckyCharm?: boolean } = {},
): { bonusGold: number } {
  if (!chance(rng, stepLootChance(options))) return { bonusGold: 0 };
  const [min, max] = STEP_LOOT_GOLD[difficulty];
  return { bonusGold: randomInt(rng, min, max) };
}

/**
 * Rolls a rare cosmetic for a finished quest. `candidates` are the ids of rare items the
 * player could receive (already-owned ones are skipped). Returns null when nothing dropped
 * or nothing is left to give.
 */
export function rollQuestLoot(
  rng: Rng,
  difficulty: Difficulty,
  candidates: readonly string[],
  owned: ReadonlySet<string> = new Set(),
): { rareItemId: string | null } {
  if (!chance(rng, RARE_DROP_CHANCE[difficulty])) return { rareItemId: null };
  const available = candidates.filter((id) => !owned.has(id));
  if (available.length === 0) return { rareItemId: null };
  return { rareItemId: pick(rng, available) };
}
