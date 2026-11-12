import { addDays, type LocalDate } from '@/domain/dates';
import { defaultStepFor, isQuickByRule } from '@/domain/steps';
import type { Reward } from '@/domain/types';
import { clock } from '../clock';
import { db, type SingletonTableName } from '../db';
import type { LedgerEvent, NewRow, Quest, RowPatch, Step, SyncTables, Uuid } from '../types';
import { createRepository, recordChange, stampNewRow } from './base';

export { createRepository, isAlive, recordChange, RowNotFoundError, stampNewRow } from './base';
export type { Repository } from './base';

/* ------------------------------------------------------------ plain repos */

export const questsRepo = createRepository('quests');
export const stepsRepo = createRepository('steps');
export const categoriesRepo = createRepository('categories');
export const tagsRepo = createRepository('tags');
export const templatesRepo = createRepository('templates');
export const recurrenceRulesRepo = createRepository('recurrence_rules');
export const focusSessionsRepo = createRepository('focus_sessions');
export const distractionNotesRepo = createRepository('distraction_notes');
export const focusBlocksRepo = createRepository('focus_blocks');
export const inventoryRepo = createRepository('inventory');
export const userRewardsRepo = createRepository('user_rewards');
export const powerUpActivationsRepo = createRepository('power_up_activations');
export const achievementsRepo = createRepository('achievements');
export const dailyQuestsRepo = createRepository('daily_quests');
export const energyCheckinsRepo = createRepository('energy_checkins');
export const calendarLinksRepo = createRepository('calendar_links');
export const aiUsageRepo = createRepository('ai_usage');
/** Append-only: `update`, `remove` and `restore` reject. Use `appendLedgerEvent`. */
export const ledgerRepo = createRepository('ledger_events', { appendOnly: true });

const singletonRepos = {
  profile: createRepository('profile'),
  settings: createRepository('settings'),
  streak_state: createRepository('streak_state'),
  notification_prefs: createRepository('notification_prefs'),
};

/* ------------------------------------------------------------- singletons */

export class MissingSingletonError extends Error {
  constructor(table: string) {
    super(`No ${table} row. Call ensureLocalData() at startup.`);
    this.name = 'MissingSingletonError';
  }
}

/** The live row of a one-row table (profile, settings, streak_state, notification_prefs). */
export async function getSingleton<N extends SingletonTableName>(
  name: N,
): Promise<SyncTables[N] | undefined> {
  const rows = await db
    .table<SyncTables[N], Uuid>(name)
    .filter((r) => r.deleted_at === null)
    .toArray();
  // If two devices each created one before the first sync, the oldest wins deterministically.
  rows.sort((a, b) =>
    a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id < b.id ? -1 : 1,
  );
  return rows[0];
}

export async function requireSingleton<N extends SingletonTableName>(
  name: N,
): Promise<SyncTables[N]> {
  const row = await getSingleton(name);
  if (!row) throw new MissingSingletonError(name);
  return row;
}

export async function updateSingleton<N extends SingletonTableName>(
  name: N,
  patch: RowPatch<SyncTables[N]>,
): Promise<SyncTables[N]> {
  return db.transaction('rw', db.table(name), db.outbox, async () => {
    const row = await requireSingleton(name);
    const repo = singletonRepos[name] as unknown as ReturnType<typeof createRepository<N>>;
    return repo.update(row.id, patch);
  });
}

export const getSettings = () => requireSingleton('settings');
export const updateSettings = (patch: RowPatch<SyncTables['settings']>) =>
  updateSingleton('settings', patch);
export const getProfile = () => requireSingleton('profile');
export const updateProfile = (patch: RowPatch<SyncTables['profile']>) =>
  updateSingleton('profile', patch);
export const getNotificationPrefs = () => requireSingleton('notification_prefs');
export const updateNotificationPrefs = (patch: RowPatch<SyncTables['notification_prefs']>) =>
  updateSingleton('notification_prefs', patch);
export const getStreakState = () => requireSingleton('streak_state');
export const updateStreakState = (patch: RowPatch<SyncTables['streak_state']>) =>
  updateSingleton('streak_state', patch);

/** Creates a singleton row if none exists. Used by ensureLocalData. */
export async function ensureSingleton<N extends SingletonTableName>(
  name: N,
  input: NewRow<SyncTables[N]>,
): Promise<SyncTables[N]> {
  return db.transaction('rw', db.table(name), db.outbox, async () => {
    const existing = await getSingleton(name);
    if (existing) return existing;
    const repo = singletonRepos[name] as unknown as ReturnType<typeof createRepository<N>>;
    return repo.create(input);
  });
}

/* ----------------------------------------------------------------- quests */

export type NewStepInput = Pick<Step, 'title'> &
  Partial<Pick<Step, 'guess_minutes' | 'quick' | 'quick_source'>>;

export type NewQuestInput = Pick<Quest, 'title'> &
  Partial<Omit<NewRow<Quest>, 'title'>> & {
    /** Optional. A quest saved with none gets one step named after the quest. */
    steps?: NewStepInput[];
  };

function questDefaults(input: NewQuestInput): NewRow<Quest> {
  const { steps: _steps, ...rest } = input;
  return {
    notes: '',
    status: 'backlog',
    priority: 'medium',
    difficulty: 'C',
    guess_minutes: null,
    due_date: null,
    due_time: null,
    category_id: null,
    tag_ids: [],
    source: 'manual',
    recurrence_rule_id: null,
    occurrence_date: null,
    template_id: null,
    is_boss: false,
    boss_started_at: null,
    activated_at: null,
    completed_at: null,
    archived_at: null,
    last_touched_at: null,
    overdue_asked_at: null,
    overdue_answer: null,
    position: clock.now(),
    ...rest,
  };
}

/**
 * Creates a quest with its steps in one transaction. With no steps, the quest gets one
 * step named after it (plan section 1). Steps without an explicit `quick` flag use the
 * offline rule (guess of 5 minutes or less).
 */
export async function createQuest(input: NewQuestInput): Promise<{ quest: Quest; steps: Step[] }> {
  return db.transaction('rw', db.quests, db.steps, db.outbox, async () => {
    const quest = await questsRepo.create(questDefaults(input));
    const stepInputs: NewStepInput[] = input.steps?.length
      ? input.steps
      : [
          {
            ...defaultStepFor({ title: quest.title, guess_minutes: quest.guess_minutes }),
            quick_source: 'rule',
          },
        ];
    const steps = await stepsRepo.createMany(
      stepInputs.map((s, i) => ({
        quest_id: quest.id,
        title: s.title,
        position: i + 1,
        guess_minutes: s.guess_minutes ?? null,
        quick: s.quick ?? isQuickByRule(s.guess_minutes),
        quick_source: s.quick_source ?? (s.quick === undefined ? 'rule' : 'user'),
        done_at: null,
        actual_ms: 0,
        completed_without_timer: false,
        no_timer_confirmed: false,
        no_timer_warned_at: null,
      })),
    );
    return { quest, steps };
  });
}

/** Live steps of a quest, in order. */
export async function listSteps(questId: Uuid): Promise<Step[]> {
  const rows = await db.steps.where('quest_id').equals(questId).toArray();
  return rows.filter((s) => s.deleted_at === null).sort((a, b) => a.position - b.position);
}

/** Marks a quest as touched now (ordering, boss eligibility). */
export function touchQuest(questId: Uuid): Promise<Quest> {
  return questsRepo.update(questId, { last_touched_at: clock.iso() });
}

/** Live quests with a given status. */
export async function listQuestsByStatus(status: Quest['status']): Promise<Quest[]> {
  const rows = await db.quests.where('status').equals(status).toArray();
  return rows.filter((q) => q.deleted_at === null);
}

/* ----------------------------------------------------------------- ledger */

export type NewLedgerEvent = Omit<
  NewRow<LedgerEvent>,
  'occurred_at' | 'day' | 'meta' | 'quest_id'
> &
  Partial<Pick<LedgerEvent, 'occurred_at' | 'day' | 'meta' | 'quest_id'>>;

/**
 * Appends a reward or spend. Idempotent on `dedupe_key`: if an event with the key exists,
 * nothing is written and the existing event is returned with `created: false`.
 * Feature code should grant rewards through `src/services/rewards.ts`, not call this directly.
 */
export async function appendLedgerEvent(
  input: NewLedgerEvent,
): Promise<{ event: LedgerEvent; created: boolean }> {
  return db.transaction('rw', db.ledger_events, db.outbox, async () => {
    const existing = await db.ledger_events.where('dedupe_key').equals(input.dedupe_key).first();
    if (existing) return { event: existing, created: false };
    const occurredAt = input.occurred_at ?? clock.iso();
    const row = stampNewRow<LedgerEvent>({
      ...input,
      occurred_at: occurredAt,
      day: input.day ?? clock.today(),
      meta: input.meta ?? null,
      quest_id: input.quest_id ?? null,
    });
    await db.ledger_events.add(row);
    await recordChange('ledger_events', row.id, 'upsert');
    return { event: row, created: true };
  });
}

/** Whether a reward with this key was already granted. */
export async function hasLedgerKey(dedupeKey: string): Promise<boolean> {
  return (await db.ledger_events.where('dedupe_key').equals(dedupeKey).count()) > 0;
}

async function liveLedger(): Promise<LedgerEvent[]> {
  return db.ledger_events.filter((e) => e.deleted_at === null).toArray();
}

/** Lifetime XP and current gold, summed from the ledger. */
export async function ledgerTotals(): Promise<Reward> {
  const events = await liveLedger();
  return sumLedger(events);
}

export function sumLedger(events: readonly Pick<LedgerEvent, 'xp' | 'gold'>[]): Reward {
  let xp = 0;
  let gold = 0;
  for (const e of events) {
    xp += e.xp;
    gold += e.gold;
  }
  return { xp, gold };
}

/** Live ledger events that belong to a quest (step rewards, finish, boss bonus, step loot). */
export async function ledgerForQuest(
  questId: Uuid,
  kinds?: LedgerEvent['kind'][],
): Promise<LedgerEvent[]> {
  const events = await db.ledger_events.where('quest_id').equals(questId).toArray();
  return events.filter((e) => e.deleted_at === null && (!kinds || kinds.includes(e.kind)));
}

/** Days with at least one finished step (streak input). */
export async function activeDays(): Promise<LocalDate[]> {
  const events = await db.ledger_events.where('kind').equals('step_reward').toArray();
  return [...new Set(events.filter((e) => e.deleted_at === null).map((e) => e.day))].sort();
}

/** XP earned in the 7-day window starting on `weekStart` (for weekly recap and future leaderboards). */
export async function xpInWeek(weekStart: LocalDate): Promise<number> {
  const end = addDays(weekStart, 7);
  const events = await db.ledger_events.where('day').between(weekStart, end, true, false).toArray();
  return events.filter((e) => e.deleted_at === null).reduce((sum, e) => sum + Math.max(0, e.xp), 0);
}
