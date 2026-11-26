/**
 * Builds the achievement stats snapshot from the database and unlocks what is newly met:
 * an `achievements` row, a fixed gold grant (dedupe `achievement:<id>`) and the
 * `achievement.unlocked` event, all in one transaction.
 */
import { achievementsRepo, clock, db, getProfile, writeTransaction } from '@/data';
import { diffDays } from '@/domain/dates';
import { levelFromXp } from '@/domain/levels';
import { events, grantReward, REWARD_TABLES } from '@/services';
import { achievementById, newlyAchieved, type AchievementStats } from '../catalog/achievements';
import { decorationsPlaced, DEFAULT_LOOK } from './looks';

const alive = <T extends { deleted_at: string | null }>(rows: T[]) =>
  rows.filter((r) => r.deleted_at === null);

/** Estimates within this ratio of the actual time count as accurate. */
export const ACCURATE_RANGE = [0.75, 1.25] as const;

/** Days with a gap of at least this many missed days before them count as a comeback. */
export const COMEBACK_GAP = 2;

/** Pure: whether the sorted active days contain a return after a rest. */
export function hasComeback(days: readonly string[]): boolean {
  const sorted = [...new Set(days)].sort();
  for (let i = 1; i < sorted.length; i++) {
    if (diffDays(sorted[i - 1]!, sorted[i]!) - 1 >= COMEBACK_GAP) return true;
  }
  return false;
}

/** Pure: actual/guess ratio within ACCURATE_RANGE. */
export function isAccurate(guessMinutes: number | null, actualMs: number): boolean {
  if (!guessMinutes || guessMinutes <= 0 || actualMs <= 0) return false;
  const ratio = actualMs / 60_000 / guessMinutes;
  return ratio >= ACCURATE_RANGE[0] && ratio <= ACCURATE_RANGE[1];
}

export async function buildAchievementStats(): Promise<AchievementStats> {
  const ledger = alive(await db.ledger_events.toArray());
  const byKind = (k: string) => ledger.filter((e) => e.kind === k);
  const xp = ledger.reduce((s, e) => s + e.xp, 0);

  const stepRewards = byKind('step_reward');
  const finishes = byKind('quest_finish');
  const finishedIds = finishes.map((e) => e.source_id!).filter(Boolean);
  const finishedQuests = alive(
    (await db.quests.bulkGet(finishedIds)).filter((q): q is NonNullable<typeof q> => !!q),
  );

  const doneSteps = alive(await db.steps.toArray()).filter((s) => s.done_at);
  const stepsByQuest = new Map<string, number>();
  for (const s of alive(await db.steps.toArray())) {
    stepsByQuest.set(s.quest_id, (stepsByQuest.get(s.quest_id) ?? 0) + s.actual_ms);
  }
  const hours = doneSteps.map((s) => new Date(s.done_at!).getHours());

  const sessions = alive(await db.focus_sessions.toArray()).filter(
    (s) => s.kind === 'focus' && s.ended_at !== null && s.focused_ms >= 60_000,
  );
  const inventory = alive(await db.inventory.toArray());
  const profile = await getProfile();
  const avatar = profile.avatar;
  const avatarChanged = (Object.keys(DEFAULT_LOOK) as Array<keyof typeof DEFAULT_LOOK>).some(
    (k) => (avatar[k] ?? null) !== DEFAULT_LOOK[k],
  );

  return {
    stepsCompleted: stepRewards.length,
    quickSteps: doneSteps.filter((s) => s.quick).length,
    questsCompleted: finishes.length,
    sRankQuests: finishedQuests.filter((q) => q.difficulty === 'S').length,
    bossesDefeated: byKind('boss_bonus').length,
    focusSessions: sessions.length,
    focusMinutes: Math.floor(sessions.reduce((s, x) => s + x.focused_ms, 0) / 60_000),
    longestSessionMinutes: Math.floor(Math.max(0, ...sessions.map((s) => s.focused_ms)) / 60_000),
    activeDays: new Set(stepRewards.map((e) => e.day)).size,
    cameBackAfterRest: hasComeback(stepRewards.map((e) => e.day)),
    level: levelFromXp(xp).level,
    accurateEstimates: finishedQuests.filter((q) =>
      isAccurate(q.guess_minutes, stepsByQuest.get(q.id) ?? 0),
    ).length,
    dailyQuestsCompleted: alive(await db.daily_quests.toArray()).filter((d) => d.rewarded_at)
      .length,
    rewardsRedeemed: inventory.filter((i) => i.kind === 'user_reward' && i.used_at).length,
    powerUpsUsed: alive(await db.power_up_activations.toArray()).length,
    distractionsParked: alive(await db.distraction_notes.toArray()).length,
    energyCheckins: alive(await db.energy_checkins.toArray()).length,
    inboxSorted: alive(await db.quests.toArray()).filter(
      (q) => (q.source === 'quick_capture' || q.source === 'distraction') && q.status !== 'inbox',
    ).length,
    earlyBirdSteps: hours.filter((h) => h < 9).length,
    nightOwlSteps: hours.filter((h) => h >= 21).length,
    avatarChanged,
    decorationsPlaced: decorationsPlaced(profile.cottage),
    cosmeticsBought: inventory.filter((i) => i.kind === 'cosmetic' && i.source === 'purchase')
      .length,
  };
}

/** Unlocks every achievement whose condition is met now. Returns the new ids. */
export async function checkAchievements(): Promise<string[]> {
  const stats = await buildAchievementStats();
  const unlocked = new Set(alive(await db.achievements.toArray()).map((a) => a.achievement_id));
  const fresh = newlyAchieved(stats, unlocked);
  const done: string[] = [];
  for (const id of fresh) {
    const def = achievementById(id)!;
    await writeTransaction(['achievements', ...REWARD_TABLES], async () => {
      if (await db.achievements.where('achievement_id').equals(id).first()) return;
      await achievementsRepo.create({ achievement_id: id, unlocked_at: clock.iso() });
      await grantReward({
        kind: 'fixed',
        ledgerKind: 'achievement',
        sourceType: 'achievement',
        sourceId: id,
        dedupeKey: `achievement:${id}`,
        reward: { xp: 0, gold: def.gold },
      });
      events.emitAfterCommit('achievement.unlocked', { achievementId: id });
      done.push(id);
    });
  }
  return done;
}
