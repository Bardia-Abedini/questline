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

/**
 * Rolls loot for a completed step. Returns the bonus gold (0 when nothing dropped).
 * Uses exactly two rng draws when it drops, one when it does not.
 */
export function rollStepLoot(rng: Rng, difficulty: Difficulty): { bonusGold: number } {
  if (!chance(rng, STEP_LOOT_CHANCE)) return { bonusGold: 0 };
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
