/**
 * Live queries for the Quests screens. Every hook returns `undefined` while loading.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { estimateRatios, type EstimateRatios } from '@/domain/estimates';
import { sortActiveQuests } from '@/domain/quests';
import {
  db,
  type Category,
  type Quest,
  type QuestStatus,
  type Step,
  type Tag,
  type Uuid,
} from '@/data';
import { useCategories, useTags } from '@/data/hooks';
import { estimateSamples } from './model/estimates';

export interface QuestWithSteps {
  quest: Quest;
  steps: Step[];
}

const alive = <T extends { deleted_at: string | null }>(rows: T[]) =>
  rows.filter((r) => r.deleted_at === null);

async function withSteps(quests: Quest[]): Promise<QuestWithSteps[]> {
  const ids = quests.map((q) => q.id);
  const steps = ids.length ? alive(await db.steps.where('quest_id').anyOf(ids).toArray()) : [];
  const byQuest = new Map<Uuid, Step[]>();
  for (const s of steps) {
    const list = byQuest.get(s.quest_id) ?? [];
    list.push(s);
    byQuest.set(s.quest_id, list);
  }
  return quests.map((quest) => ({
    quest,
    steps: (byQuest.get(quest.id) ?? []).sort((a, b) => a.position - b.position),
  }));
}

function sortForStatus(status: QuestStatus, quests: Quest[]): Quest[] {
  if (status === 'active') return sortActiveQuests(quests);
  const key = (q: Quest) =>
    status === 'done'
      ? (q.completed_at ?? q.updated_at)
      : status === 'archived'
        ? (q.archived_at ?? q.updated_at)
        : q.created_at;
  // Newest first everywhere except the backlog, which keeps the order quests came in.
  const sorted = quests.slice().sort((a, b) => (key(a) < key(b) ? 1 : key(a) > key(b) ? -1 : 0));
  return status === 'backlog' ? sorted.reverse() : sorted;
}

/** Quests with a status (sorted for that list), each with its steps in order. */
export function useQuestList(status: QuestStatus): QuestWithSteps[] | undefined {
  return useLiveQuery(async () => {
    const quests = alive(await db.quests.where('status').equals(status).toArray());
    return withSteps(sortForStatus(status, quests));
  }, [status]);
}

/** Number of live quests per status (tab badges). */
export function useStatusCounts(): Record<QuestStatus, number> | undefined {
  return useLiveQuery(async () => {
    const counts: Record<QuestStatus, number> = {
      inbox: 0,
      backlog: 0,
      active: 0,
      done: 0,
      archived: 0,
    };
    await db.quests.each((q) => {
      if (q.deleted_at === null) counts[q.status] += 1;
    });
    return counts;
  }, []);
}

export function useQuestWithSteps(id: Uuid | undefined): QuestWithSteps | null | undefined {
  return useLiveQuery(async () => {
    if (!id) return null;
    const quest = await db.quests.get(id);
    if (!quest || quest.deleted_at !== null) return null;
    return (await withSteps([quest]))[0]!;
  }, [id]);
}

export function useRecurrenceRule(id: Uuid | null | undefined) {
  return useLiveQuery(async () => {
    if (!id) return null;
    const rule = await db.recurrence_rules.get(id);
    return rule && rule.deleted_at === null ? rule : null;
  }, [id]);
}

/** The player's actual/guess ratios from finished quests (estimate trainer). */
export function useEstimateRatios(): EstimateRatios | undefined {
  return useLiveQuery(async () => {
    const done = alive(await db.quests.where('status').equals('done').toArray());
    const list = await withSteps(done);
    return estimateRatios(estimateSamples(done, new Map(list.map((x) => [x.quest.id, x.steps]))));
  }, []);
}

export function useCategoryMap(): ReadonlyMap<Uuid, Category> {
  const categories = useCategories();
  return useMemo(() => new Map((categories ?? []).map((c) => [c.id, c])), [categories]);
}

export function useTagMap(): ReadonlyMap<Uuid, Tag> {
  const tags = useTags();
  return useMemo(() => new Map((tags ?? []).map((t) => [t.id, t])), [tags]);
}
