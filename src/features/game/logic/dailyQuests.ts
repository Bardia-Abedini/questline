/**
 * Daily quests: three small optional goals a day (domain generator), progress counted from
 * the data layer, gold paid through grantReward when one is done. Never a penalty for
 * skipping; yesterday's goals simply stay behind.
 */
import {
  clock,
  dailyQuestsRepo,
  db,
  getProfile,
  localMeta,
  writeTransaction,
  type DailyQuest,
  type LocalDate,
} from '@/data';
import {
  DAILY_QUEST_POOL,
  dailyQuestProgress,
  generateDailyQuests,
  rerollDailyQuest,
  type DailyQuestDef,
  type DayActivity,
} from '@/domain/dailyQuests';
import { addDays, localDateTimeToMs, toLocalDate } from '@/domain/dates';
import { createRng, type Rng } from '@/domain/rng';
import { events, grantReward, REWARD_TABLES } from '@/services';
import { spendPowerUp } from './powerUps';

const alive = <T extends { deleted_at: string | null }>(rows: T[]) =>
  rows.filter((r) => r.deleted_at === null);

/** A quest touched by a step today counts as "old" when it was created this many days ago. */
export const OLD_QUEST_DAYS = 7;
/** A focus session counts toward "sessions" goals from this many focused minutes. */
export const MIN_SESSION_MINUTES = 1;

export function defFor(row: Pick<DailyQuest, 'quest_key'>): DailyQuestDef | undefined {
  return DAILY_QUEST_POOL.find((d) => d.key === row.quest_key);
}

export async function listDailyQuests(day: LocalDate): Promise<DailyQuest[]> {
  const rows = alive(await db.daily_quests.where('day').equals(day).toArray());
  return rows.sort((a, b) => a.slot - b.slot);
}

/** Creates today's three goals if they do not exist yet. Safe to call often. */
export async function ensureDailyQuests(day: LocalDate = clock.today()): Promise<DailyQuest[]> {
  const profile = await getProfile();
  return writeTransaction(['daily_quests', 'profile'], async () => {
    const existing = await listDailyQuests(day);
    if (existing.length > 0) return existing;
    const defs = generateDailyQuests(day, profile.id);
    return dailyQuestsRepo.createMany(
      defs.map((d, slot) => ({
        day,
        slot,
        quest_key: d.key,
        kind: d.kind,
        target: d.target,
        reward_gold: d.rewardGold,
        completed_at: null,
        rewarded_at: null,
        rerolled: false,
      })),
    );
  });
}

const inboxKey = (day: LocalDate) => `game.inbox_sorted.${day}`;

/** Inbox sorting leaves no dated record, so it is counted from `inbox.sorted` on this device. */
export async function countInboxSorted(day: LocalDate = clock.today()): Promise<void> {
  const n = (await localMeta.get<number>(inboxKey(day))) ?? 0;
  await localMeta.set(inboxKey(day), n + 1);
}

/** What the player did on `day`, counted from saved data. */
export async function dayActivity(day: LocalDate): Promise<DayActivity> {
  const start = new Date(localDateTimeToMs(day)).toISOString();
  const end = new Date(localDateTimeToMs(addDays(day, 1))).toISOString();
  const onDay = (iso: string | null) => !!iso && toLocalDate(Date.parse(iso)) === day;

  const steps = alive(
    await db.steps.where('done_at').between(start, end, true, false).toArray(),
  ).filter((s) => onDay(s.done_at));
  const questIds = [...new Set(steps.map((s) => s.quest_id))];
  const quests = (await db.quests.bulkGet(questIds)).filter((q) => !!q);
  const oldLimit = addDays(day, -OLD_QUEST_DAYS);
  const oldQuests = quests.filter((q) => toLocalDate(Date.parse(q!.created_at)) <= oldLimit);

  const sessions = alive(
    await db.focus_sessions.where('ended_at').between(start, end, true, false).toArray(),
  ).filter((s) => s.kind === 'focus' && onDay(s.ended_at));
  const focusMs = sessions.reduce((sum, s) => sum + Math.max(0, s.focused_ms), 0);

  const finished = alive(await db.quests.where('status').equals('done').toArray()).filter((q) =>
    onDay(q.completed_at),
  );
  const energy = alive(await db.energy_checkins.where('day').equals(day).toArray());

  return {
    stepsFinished: steps.length,
    quickStepsFinished: steps.filter((s) => s.quick).length,
    focusMinutes: Math.floor(focusMs / 60_000),
    focusSessions: sessions.filter((s) => s.focused_ms >= MIN_SESSION_MINUTES * 60_000).length,
    questsFinished: finished.length,
    energyCheckins: energy.length,
    inboxSorted: (await localMeta.get<number>(inboxKey(day))) ?? 0,
    oldQuestsTouched: oldQuests.length,
  };
}

/** Pays every goal of `day` that is done but not yet rewarded. Returns the ones paid now. */
export async function evaluateDailyQuests(day: LocalDate = clock.today()): Promise<DailyQuest[]> {
  const rows = await listDailyQuests(day);
  if (rows.length === 0) return [];
  const activity = await dayActivity(day);
  const paid: DailyQuest[] = [];
  for (const row of rows) {
    if (row.rewarded_at) continue;
    const def = defFor(row) ?? {
      key: row.quest_key,
      kind: row.kind,
      target: row.target,
      rewardGold: row.reward_gold,
    };
    if (!dailyQuestProgress({ ...def, target: row.target }, activity).done) continue;
    await writeTransaction([...REWARD_TABLES], async () => {
      const grant = await grantReward({ kind: 'daily_quest', dailyQuestId: row.id });
      if (!grant.alreadyGranted) {
        events.emitAfterCommit('daily_quest.completed', {
          dailyQuestId: row.id,
          reward: { xp: 0, gold: row.reward_gold },
        });
        paid.push(row);
      }
    });
  }
  return paid;
}

/** Swaps one unfinished goal for a different one, using a daily-reroll power-up. */
export async function rerollDaily(
  dailyQuestId: string,
  rng: Rng = createRng(clock.now() >>> 0),
): Promise<DailyQuest> {
  const row = await dailyQuestsRepo.get(dailyQuestId);
  if (!row || row.completed_at) throw new RangeError('This goal cannot be swapped');
  const rows = await listDailyQuests(row.day);
  const defs = rows.map(
    (r) =>
      defFor(r) ?? { key: r.quest_key, kind: r.kind, target: r.target, rewardGold: r.reward_gold },
  );
  const index = rows.findIndex((r) => r.id === row.id);
  const next = rerollDailyQuest(defs, index, rng)[index]!;
  if (next.key === row.quest_key) throw new RangeError('Nothing else to swap in');
  let updated = row;
  await spendPowerUp('daily_reroll', { type: 'daily_quest', id: row.id }, async () => {
    updated = await dailyQuestsRepo.update(row.id, {
      quest_key: next.key,
      kind: next.kind,
      target: next.target,
      reward_gold: next.rewardGold,
      rerolled: true,
    });
  });
  return updated;
}
