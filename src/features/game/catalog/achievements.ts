import type { IconName } from '@/ui';

/**
 * Achievements as data. Each has a pure condition over an AchievementStats snapshot (built
 * from the database in achievementsEngine.ts) and a progress function for the gallery.
 * Rewards are gold only, granted once through grantReward (dedupe key `achievement:<id>`).
 * Names and hints are i18n keys `game:achievements.<id>.name` / `.hint`.
 */

export interface AchievementStats {
  stepsCompleted: number;
  quickSteps: number;
  questsCompleted: number;
  sRankQuests: number;
  bossesDefeated: number;
  focusSessions: number;
  focusMinutes: number;
  longestSessionMinutes: number;
  activeDays: number;
  /** The player came back after resting at least 2 days. */
  cameBackAfterRest: boolean;
  level: number;
  accurateEstimates: number;
  dailyQuestsCompleted: number;
  rewardsRedeemed: number;
  powerUpsUsed: number;
  distractionsParked: number;
  energyCheckins: number;
  inboxSorted: number;
  earlyBirdSteps: number;
  nightOwlSteps: number;
  /** Avatar differs from the default look. */
  avatarChanged: boolean;
  /** Decorations placed (non-empty slots that differ from the starter room). */
  decorationsPlaced: number;
  cosmeticsBought: number;
}

export const EMPTY_STATS: AchievementStats = Object.freeze({
  stepsCompleted: 0,
  quickSteps: 0,
  questsCompleted: 0,
  sRankQuests: 0,
  bossesDefeated: 0,
  focusSessions: 0,
  focusMinutes: 0,
  longestSessionMinutes: 0,
  activeDays: 0,
  cameBackAfterRest: false,
  level: 1,
  accurateEstimates: 0,
  dailyQuestsCompleted: 0,
  rewardsRedeemed: 0,
  powerUpsUsed: 0,
  distractionsParked: 0,
  energyCheckins: 0,
  inboxSorted: 0,
  earlyBirdSteps: 0,
  nightOwlSteps: 0,
  avatarChanged: false,
  decorationsPlaced: 0,
  cosmeticsBought: 0,
});

export type AchievementTier = 'bronze' | 'silver' | 'gold';

export interface AchievementDef {
  id: string;
  icon: IconName;
  tier: AchievementTier;
  gold: number;
  /** Progress toward the goal, for the gallery. `current` is capped at `target`. */
  progress: (s: AchievementStats) => { current: number; target: number };
}

type NumericStat = {
  [K in keyof AchievementStats]: AchievementStats[K] extends number ? K : never;
}[keyof AchievementStats];
type BoolStat = {
  [K in keyof AchievementStats]: AchievementStats[K] extends boolean ? K : never;
}[keyof AchievementStats];

function count(
  id: string,
  stat: NumericStat,
  target: number,
  icon: IconName,
  tier: AchievementTier,
  gold: number,
): AchievementDef {
  return {
    id,
    icon,
    tier,
    gold,
    progress: (s) => ({ current: Math.min(target, Math.max(0, s[stat])), target }),
  };
}

function flag(
  id: string,
  stat: BoolStat,
  icon: IconName,
  tier: AchievementTier,
  gold: number,
): AchievementDef {
  return { id, icon, tier, gold, progress: (s) => ({ current: s[stat] ? 1 : 0, target: 1 }) };
}

export const ACHIEVEMENTS: readonly AchievementDef[] = Object.freeze([
  count('first_step', 'stepsCompleted', 1, 'check', 'bronze', 10),
  count('steps_25', 'stepsCompleted', 25, 'check', 'bronze', 20),
  count('steps_100', 'stepsCompleted', 100, 'check', 'silver', 40),
  count('steps_500', 'stepsCompleted', 500, 'check', 'gold', 80),
  count('quick_10', 'quickSteps', 10, 'bolt', 'bronze', 15),
  count('first_quest', 'questsCompleted', 1, 'star', 'bronze', 15),
  count('quests_10', 'questsCompleted', 10, 'star', 'silver', 30),
  count('quests_50', 'questsCompleted', 50, 'star', 'gold', 60),
  count('first_s_rank', 'sRankQuests', 1, 'sparkle', 'gold', 50),
  count('boss_defeated', 'bossesDefeated', 1, 'sword', 'silver', 40),
  count('bosses_5', 'bossesDefeated', 5, 'sword', 'gold', 80),
  count('first_session', 'focusSessions', 1, 'timer', 'bronze', 10),
  count('sessions_10', 'focusSessions', 10, 'timer', 'silver', 30),
  count('sessions_50', 'focusSessions', 50, 'timer', 'gold', 60),
  count('focus_5h', 'focusMinutes', 300, 'lantern', 'silver', 40),
  count('deep_focus', 'longestSessionMinutes', 45, 'feather', 'silver', 25),
  count('streak_3', 'activeDays', 3, 'flame', 'bronze', 15),
  count('streak_7', 'activeDays', 7, 'flame', 'silver', 30),
  count('streak_30', 'activeDays', 30, 'flame', 'gold', 80),
  flag('welcome_back', 'cameBackAfterRest', 'heart', 'bronze', 20),
  count('accurate_estimator', 'accurateEstimates', 3, 'timer', 'silver', 30),
  count('level_5', 'level', 5, 'sparkle', 'bronze', 25),
  count('level_10', 'level', 10, 'sparkle', 'silver', 50),
  count('daily_first', 'dailyQuestsCompleted', 1, 'sun', 'bronze', 10),
  count('daily_15', 'dailyQuestsCompleted', 15, 'sun', 'silver', 40),
  count('first_treat', 'rewardsRedeemed', 1, 'gift', 'bronze', 15),
  count('treats_10', 'rewardsRedeemed', 10, 'gift', 'silver', 40),
  flag('dress_up', 'avatarChanged', 'palette', 'bronze', 10),
  count('decorator', 'decorationsPlaced', 5, 'home', 'silver', 20),
  count('first_purchase', 'cosmeticsBought', 1, 'shop', 'bronze', 10),
  count('first_power_up', 'powerUpsUsed', 1, 'potion', 'bronze', 10),
  count('thought_parked', 'distractionsParked', 1, 'feather', 'bronze', 10),
  count('energy_5', 'energyCheckins', 5, 'battery', 'bronze', 15),
  count('inbox_tidy', 'inboxSorted', 10, 'inbox', 'silver', 20),
  count('early_bird', 'earlyBirdSteps', 1, 'sun', 'bronze', 15),
  count('night_owl', 'nightOwlSteps', 1, 'moon', 'bronze', 15),
]);

export function achievementById(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

export function isAchieved(def: AchievementDef, stats: AchievementStats): boolean {
  const p = def.progress(stats);
  return p.current >= p.target;
}

/** Ids whose condition holds now and that are not unlocked yet. Pure. */
export function newlyAchieved(stats: AchievementStats, unlocked: ReadonlySet<string>): string[] {
  return ACHIEVEMENTS.filter((a) => !unlocked.has(a.id) && isAchieved(a, stats)).map((a) => a.id);
}
