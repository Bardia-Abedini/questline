/**
 * Recurring quests (plan section 1). One open occurrence per series at a time:
 * - when the current occurrence is finished, the next one is created right away (dated by
 *   `planNextOccurrence`, so it is always today or later);
 * - when its day passes unfinished, the same quest quietly moves forward to the next date
 *   (its progress is kept), so missed occurrences never pile up and nothing is "failed".
 * A new occurrence lands on Active when its day has come and there is room, otherwise in
 * the backlog; a backlog occurrence that was never activated moves to Active on its day.
 */
import {
  nextOccurrenceOnOrAfter,
  planNextOccurrence,
  type RecurrencePattern,
} from '@/domain/recurrence';
import { canActivateAnother } from '@/domain/quests';
import {
  clock,
  createQuest,
  db,
  getSettings,
  questsRepo,
  recurrenceRulesRepo,
  writeTransaction,
  type LocalDate,
  type Quest,
  type RecurrenceRule,
  type Uuid,
} from '@/data';
import { events } from '@/services';

export const RECURRENCE_TABLES = ['quests', 'steps', 'recurrence_rules', 'settings'] as const;

export function patternOf(
  rule: Pick<RecurrenceRule, 'kind' | 'anchor_date' | 'interval' | 'weekdays' | 'end_date'>,
): RecurrencePattern {
  return {
    kind: rule.kind,
    anchorDate: rule.anchor_date,
    interval: rule.interval,
    weekdays: rule.weekdays,
    endDate: rule.end_date,
  };
}

async function activeCount(): Promise<number> {
  const rows = await db.quests.where('status').equals('active').toArray();
  return rows.filter((q) => q.deleted_at === null).length;
}

async function hasRoom(): Promise<boolean> {
  const settings = await getSettings();
  return canActivateAnother(await activeCount(), settings.active_limit);
}

/** Creates the occurrence of `rule` for `day` and makes it the series' current quest. */
export async function createOccurrence(
  rule: RecurrenceRule,
  day: LocalDate,
  today: LocalDate,
  /** Where it goes; by default Active when its day has come and there is room. */
  status?: 'active' | 'backlog',
): Promise<Quest> {
  return writeTransaction(RECURRENCE_TABLES, async () => {
    const t = rule.template;
    const activate = status ? status === 'active' : day <= today && (await hasRoom());
    const at = clock.iso();
    const { quest } = await createQuest({
      title: t.title,
      notes: t.notes,
      priority: t.priority,
      difficulty: t.difficulty,
      guess_minutes: t.guess_minutes,
      category_id: t.category_id,
      tag_ids: t.tag_ids.slice(),
      due_date: day,
      due_time: t.due_time,
      source: 'recurrence',
      recurrence_rule_id: rule.id,
      occurrence_date: day,
      status: activate ? 'active' : 'backlog',
      activated_at: activate ? at : null,
      steps: t.steps.length
        ? t.steps.map((s) => ({
            title: s.title,
            guess_minutes: s.guess_minutes,
            quick: s.quick,
            quick_source: 'user' as const,
          }))
        : undefined,
    });
    await recurrenceRulesRepo.update(rule.id, {
      current_quest_id: quest.id,
      current_occurrence_date: day,
    });
    events.emitAfterCommit('quest.created', { questId: quest.id, source: 'recurrence' });
    if (activate) events.emitAfterCommit('quest.activated', { questId: quest.id });
    return quest;
  });
}

/**
 * Brings one series up to date. Returns the quest created or moved, if any.
 * Safe to call any number of times (it only acts when something is due).
 */
export async function advanceRule(ruleId: Uuid, today: LocalDate): Promise<Quest | null> {
  return writeTransaction(RECURRENCE_TABLES, async () => {
    const rule = await recurrenceRulesRepo.get(ruleId);
    if (!rule || !rule.active) return null;
    const pattern = patternOf(rule);
    const current = rule.current_quest_id ? await questsRepo.get(rule.current_quest_id) : undefined;
    const currentDay = rule.current_occurrence_date;

    const open = current && (current.status === 'active' || current.status === 'backlog');
    if (open && current) {
      // Still open: move it forward only when its day has passed.
      if (currentDay && currentDay < today) {
        const next = planNextOccurrence(pattern, currentDay, today);
        if (!next) return null;
        const moved = await questsRepo.update(current.id, {
          occurrence_date: next,
          due_date: next,
        });
        await recurrenceRulesRepo.update(rule.id, { current_occurrence_date: next });
        return moved;
      }
      // Its day came while it waited in the backlog: bring it to Active once, if there is room.
      if (
        current.status === 'backlog' &&
        current.activated_at === null &&
        currentDay !== null &&
        currentDay <= today &&
        (await hasRoom())
      ) {
        const at = clock.iso();
        const activated = await questsRepo.update(current.id, {
          status: 'active',
          activated_at: at,
        });
        events.emitAfterCommit('quest.activated', { questId: current.id });
        return activated;
      }
      return null;
    }

    // Finished, archived, sorted elsewhere or deleted: plan the next one.
    if (current && current.status === 'inbox') return null;
    const next = currentDay
      ? planNextOccurrence(pattern, currentDay, today)
      : nextOccurrenceOnOrAfter(pattern, today);
    if (!next) {
      await recurrenceRulesRepo.update(rule.id, { active: false, current_quest_id: null });
      return null;
    }
    return createOccurrence(rule, next, today);
  });
}

/** Brings every active series up to date (app start, a new day, after a finish). */
export async function rollRecurrences(today: LocalDate = clock.today()): Promise<void> {
  const rules = await recurrenceRulesRepo.list((r) => r.active);
  for (const rule of rules) {
    try {
      await advanceRule(rule.id, today);
    } catch (error) {
      console.error('[quests] recurrence roll failed', error);
    }
  }
}
