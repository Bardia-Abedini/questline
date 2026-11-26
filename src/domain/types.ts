/**
 * Vocabulary shared by the domain engine and the data layer.
 * The data layer imports these; the domain never imports from the data layer.
 */

export const DIFFICULTIES = ['E', 'D', 'C', 'B', 'A', 'S'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const PRIORITIES = ['high', 'medium', 'low'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const QUEST_STATUSES = ['inbox', 'backlog', 'active', 'done', 'archived'] as const;
export type QuestStatus = (typeof QUEST_STATUSES)[number];

export const ENERGY_LEVELS = ['low', 'medium', 'high'] as const;
export type EnergyLevel = (typeof ENERGY_LEVELS)[number];

/** XP and gold together. Gold may be negative only in ledger entries for spending. */
export interface Reward {
  xp: number;
  gold: number;
}

export const ZERO_REWARD: Reward = Object.freeze({ xp: 0, gold: 0 });

export function addRewards(...rewards: Reward[]): Reward {
  return rewards.reduce((acc, r) => ({ xp: acc.xp + r.xp, gold: acc.gold + r.gold }), {
    xp: 0,
    gold: 0,
  });
}
