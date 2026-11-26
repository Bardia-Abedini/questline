/**
 * Level curve (plan section 6): XP needed to go from `level` to `level + 1`
 * is 100 + 50 x (level - 1). Players start at level 1 with 0 XP.
 * Level is always derived from total XP; it is never stored.
 */

export const MILESTONE_EVERY = 5;

/** XP needed to climb from `level` to the next level. */
export function xpForNextLevel(level: number): number {
  const l = Math.max(1, Math.floor(level));
  return 100 + 50 * (l - 1);
}

/** Total XP needed to reach `level` from zero (level 1 needs 0). */
export function totalXpForLevel(level: number): number {
  const n = Math.max(1, Math.floor(level)) - 1; // levels climbed
  // sum_{k=0}^{n-1} (100 + 50k) = 100n + 25n(n-1)
  return 100 * n + 25 * n * (n - 1);
}

export interface LevelInfo {
  level: number;
  /** XP earned since reaching this level. */
  xpIntoLevel: number;
  /** XP this level takes in total. */
  xpForNext: number;
  /** XP still missing for the next level. */
  xpToNext: number;
  /** 0..1, for the XP bar. */
  progress: number;
}

/** Level and XP-bar values for a total XP amount. Negative totals count as 0. */
export function levelFromXp(totalXp: number): LevelInfo {
  const xp = Number.isFinite(totalXp) ? Math.max(0, Math.floor(totalXp)) : 0;
  // Solve 25n^2 + 75n - xp <= 0 for the largest whole n, then correct for float error.
  let n = Math.floor((-75 + Math.sqrt(75 * 75 + 100 * xp)) / 50);
  n = Math.max(0, n);
  while (totalXpForLevel(n + 2) <= xp) n++;
  while (n > 0 && totalXpForLevel(n + 1) > xp) n--;
  const level = n + 1;
  const xpIntoLevel = xp - totalXpForLevel(level);
  const xpForNext = xpForNextLevel(level);
  return {
    level,
    xpIntoLevel,
    xpForNext,
    xpToNext: xpForNext - xpIntoLevel,
    progress: xpIntoLevel / xpForNext,
  };
}

/** Milestone levels are 5, 10, 15, ... They upgrade the cottage and unlock items and titles. */
export function isMilestoneLevel(level: number): boolean {
  return Number.isInteger(level) && level >= MILESTONE_EVERY && level % MILESTONE_EVERY === 0;
}

/** Cottage exterior tier: 0 at levels 1-4, 1 at 5-9, 2 at 10-14, ... */
export function cottageTier(level: number): number {
  return Math.floor(Math.max(1, level) / MILESTONE_EVERY);
}

/** Gold gift for reaching `level`: 10 x level, plus 50 on milestone levels. */
export function levelUpGold(level: number): number {
  if (level <= 1) return 0;
  return 10 * level + (isMilestoneLevel(level) ? 50 : 0);
}

/** Every level reached when total XP goes from `xpBefore` to `xpAfter`, in order. */
export function levelsGained(xpBefore: number, xpAfter: number): number[] {
  const from = levelFromXp(xpBefore).level;
  const to = levelFromXp(xpAfter).level;
  const out: number[] = [];
  for (let l = from + 1; l <= to; l++) out.push(l);
  return out;
}
