/**
 * Shared progress operations used by both Quests and Focus. They change the rows, pay the
 * reward through `grantReward`, and emit `step.completed` / `quest.completed`, all in one
 * transaction. Always use these instead of setting `done_at` / `status: 'done'` yourself,
 * or rewards, streaks and achievements will be missed.
 */
import { clock } from '@/data/clock';
import { db } from '@/data/db';
import { listSteps } from '@/data/repositories';
import { recordChange } from '@/data/repositories/base';
import type { Quest, Step, Uuid } from '@/data/types';
import type { Rng } from '@/domain/rng';
import { events } from './events';
import { grantReward, type GrantResult } from './rewards';

const PROGRESS_TABLES = () => [
  db.ledger_events,
  db.quests,
  db.steps,
  db.focus_sessions,
  db.daily_quests,
  db.inventory,
  db.streak_state,
  db.power_up_activations,
  db.outbox,
];

export interface CompleteStepOptions {
  /** The focus session the step was finished in, if any (enables double-XP potions). */
  sessionId?: Uuid | null;
  /**
   * The player confirmed the one-time "did you really finish it?" warning (non-quick step,
   * no session). Stored as `no_timer_confirmed`. Whether the step was done without a timer
   * is recorded from `sessionId` alone (`completed_without_timer`).
   */
  confirmedWithoutTimer?: boolean;
  /** Finish the quest automatically when this was its last open step. Default true. */
  autoCompleteQuest?: boolean;
  rng?: Rng;
}

export interface CompleteStepResult {
  step: Step;
  /** False when the step was already done (nothing changed, nothing paid). */
  changed: boolean;
  grant: GrantResult | null;
  /** Set when the quest was finished as a result. */
  questCompletion: CompleteQuestResult | null;
}

async function saveStep(step: Step): Promise<void> {
  await db.steps.put(step);
  await recordChange('steps', step.id, 'upsert');
}

async function saveQuest(quest: Quest): Promise<void> {
  await db.quests.put(quest);
  await recordChange('quests', quest.id, 'upsert');
}

/** Checks off a step, pays its reward, and finishes the quest if it was the last open step. */
export function completeStep(
  stepId: Uuid,
  options: CompleteStepOptions = {},
): Promise<CompleteStepResult> {
  return db.transaction('rw', PROGRESS_TABLES(), async () => {
    const step = await db.steps.get(stepId);
    if (!step || step.deleted_at !== null) throw new Error(`Unknown step ${stepId}`);
    if (step.done_at !== null) return { step, changed: false, grant: null, questCompletion: null };

    const at = clock.iso();
    const done: Step = {
      ...step,
      done_at: at,
      completed_without_timer: !options.sessionId,
      no_timer_confirmed: !options.sessionId && !!options.confirmedWithoutTimer,
      updated_at: at,
    };
    await saveStep(done);

    const quest = await db.quests.get(step.quest_id);
    if (quest && quest.deleted_at === null) {
      await saveQuest({ ...quest, last_touched_at: at, updated_at: at });
    }

    const grant = await grantReward(
      { kind: 'step', stepId, sessionId: options.sessionId ?? null },
      options.rng ? { rng: options.rng } : {},
    );

    events.emitAfterCommit('step.completed', {
      questId: step.quest_id,
      stepId,
      quick: step.quick,
      withoutTimer: done.completed_without_timer,
      confirmedWithoutTimer: done.no_timer_confirmed,
      sessionId: options.sessionId ?? null,
      grant,
    });

    let questCompletion: CompleteQuestResult | null = null;
    if (options.autoCompleteQuest !== false && quest && quest.status !== 'done') {
      const open = (await listSteps(quest.id)).filter((s) => s.done_at === null);
      if (open.length === 0)
        questCompletion = await completeQuest(quest.id, options.rng ? { rng: options.rng } : {});
    }
    return { step: done, changed: true, grant, questCompletion };
  });
}

/**
 * Un-checks a step. Rewards already paid are kept (they are never paid twice either).
 * If the quest was done, it goes back to active.
 */
export function reopenStep(stepId: Uuid): Promise<Step> {
  return db.transaction('rw', PROGRESS_TABLES(), async () => {
    const step = await db.steps.get(stepId);
    if (!step || step.deleted_at !== null) throw new Error(`Unknown step ${stepId}`);
    if (step.done_at === null) return step;
    const at = clock.iso();
    const reopened: Step = { ...step, done_at: null, updated_at: at };
    await saveStep(reopened);
    const quest = await db.quests.get(step.quest_id);
    if (quest && quest.status === 'done') {
      await saveQuest({
        ...quest,
        status: 'active',
        completed_at: null,
        last_touched_at: at,
        updated_at: at,
      });
    }
    events.emitAfterCommit('step.reopened', { questId: step.quest_id, stepId });
    return reopened;
  });
}

export interface CompleteQuestResult {
  quest: Quest;
  changed: boolean;
  /** Rewards for steps finished along with the quest. */
  stepGrants: GrantResult[];
  grant: GrantResult | null;
}

/**
 * Finishes a quest: any open steps are checked off (and paid), then the finish bonus is
 * paid (+25% for bosses, maybe a rare item). Idempotent.
 */
export function completeQuest(
  questId: Uuid,
  options: { rng?: Rng } = {},
): Promise<CompleteQuestResult> {
  return db.transaction('rw', PROGRESS_TABLES(), async () => {
    const quest = await db.quests.get(questId);
    if (!quest || quest.deleted_at !== null) throw new Error(`Unknown quest ${questId}`);
    if (quest.status === 'done') return { quest, changed: false, stepGrants: [], grant: null };

    const stepGrants: GrantResult[] = [];
    for (const s of await listSteps(questId)) {
      if (s.done_at !== null) continue;
      const r = await completeStep(s.id, {
        autoCompleteQuest: false,
        ...(options.rng ? { rng: options.rng } : {}),
      });
      if (r.grant) stepGrants.push(r.grant);
    }

    const at = clock.iso();
    const fresh = (await db.quests.get(questId))!;
    const done: Quest = {
      ...fresh,
      status: 'done',
      completed_at: at,
      last_touched_at: at,
      updated_at: at,
    };
    await saveQuest(done);
    const grant = await grantReward(
      { kind: 'quest_finish', questId },
      options.rng ? { rng: options.rng } : {},
    );
    events.emitAfterCommit('quest.completed', {
      questId,
      isBoss: done.is_boss,
      recurring: done.recurrence_rule_id !== null,
      grant,
    });
    return { quest: done, changed: true, stepGrants, grant };
  });
}
