/**
 * React hooks over the local database. They re-render whenever the underlying rows change
 * (dexie-react-hooks live queries), including changes from other tabs and from sync.
 * Every hook returns `undefined` while loading.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import type { LocalDate } from '@/domain/dates';
import { clock } from './clock';
import { db } from './db';
import { getPlayerStats } from './derived';
import { getSingleton, listQuestsByStatus, listSteps } from './repositories';
import type { QuestStatus, Uuid } from './types';

const alive = <T extends { deleted_at: string | null }>(rows: T[]) =>
  rows.filter((r) => r.deleted_at === null);

export function useSettings() {
  return useLiveQuery(() => getSingleton('settings'), []);
}

export function useProfile() {
  return useLiveQuery(() => getSingleton('profile'), []);
}

export function useNotificationPrefs() {
  return useLiveQuery(() => getSingleton('notification_prefs'), []);
}

/** XP, gold, level and streak for the header. `today` defaults to the current local day. */
export function usePlayerStats(today?: LocalDate) {
  const day = today ?? clock.today();
  return useLiveQuery(() => getPlayerStats(day), [day]);
}

export function useQuest(id: Uuid | null | undefined) {
  return useLiveQuery(
    async () => (id ? db.quests.get(id).then((q) => (q?.deleted_at ? undefined : q)) : undefined),
    [id],
  );
}

export function useQuestsByStatus(status: QuestStatus) {
  return useLiveQuery(() => listQuestsByStatus(status), [status]);
}

/** All live quests (any status). Prefer `useQuestsByStatus` for lists. */
export function useAllQuests() {
  return useLiveQuery(async () => alive(await db.quests.toArray()), []);
}

export function useSteps(questId: Uuid | null | undefined) {
  return useLiveQuery(async () => (questId ? listSteps(questId) : []), [questId]);
}

export function useCategories() {
  return useLiveQuery(async () => alive(await db.categories.orderBy('position').toArray()), []);
}

export function useTags() {
  return useLiveQuery(async () => alive(await db.tags.orderBy('name').toArray()), []);
}

export function useTemplates() {
  return useLiveQuery(async () => alive(await db.templates.toArray()), []);
}

/** The focus session that has not ended, if any (for restore after reopening). */
export function useOpenFocusSession() {
  return useLiveQuery(async () => {
    const open = (await db.focus_sessions.toArray()).filter(
      (s) => s.deleted_at === null && s.ended_at === null,
    );
    open.sort((a, b) => (a.started_at < b.started_at ? 1 : -1));
    return open[0] ?? null;
  }, []);
}

export function useDailyQuests(day: LocalDate) {
  return useLiveQuery(
    async () =>
      alive(await db.daily_quests.where('day').equals(day).toArray()).sort(
        (a, b) => a.slot - b.slot,
      ),
    [day],
  );
}

export function useLatestEnergyCheckin(day: LocalDate) {
  return useLiveQuery(async () => {
    const rows = alive(await db.energy_checkins.where('day').equals(day).toArray());
    rows.sort((a, b) => (a.at < b.at ? 1 : -1));
    return rows[0] ?? null;
  }, [day]);
}

export function useInventory() {
  return useLiveQuery(async () => alive(await db.inventory.toArray()), []);
}

export function useUserRewards() {
  return useLiveQuery(
    async () => alive(await db.user_rewards.toArray()).filter((r) => r.archived_at === null),
    [],
  );
}

export function useAchievements() {
  return useLiveQuery(async () => alive(await db.achievements.toArray()), []);
}

/** Ledger events, newest first, optionally limited. */
export function useLedger(limit?: number) {
  return useLiveQuery(async () => {
    const rows = alive(await db.ledger_events.orderBy('occurred_at').reverse().toArray());
    return limit ? rows.slice(0, limit) : rows;
  }, [limit]);
}

/** Number of pending local changes not yet synced. */
export function useOutboxCount() {
  return useLiveQuery(() => db.outbox.count(), []);
}
