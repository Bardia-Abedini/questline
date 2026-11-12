/**
 * Every write the Quests package makes. Each user action is one transaction, and events
 * are emitted after it commits (CONTRIBUTING: "Events").
 */
import { isBossEligible, canActivateAnother } from '@/domain/quests';
import { isQuickByRule } from '@/domain/steps';
import { nextOccurrenceOnOrAfter } from '@/domain/recurrence';
import {
  categoriesRepo,
  clock,
  createQuest,
  db,
  getSettings,
  listSteps,
  questsRepo,
  recurrenceRulesRepo,
  stepsRepo,
  tagsRepo,
  templatesRepo,
  writeTransaction,
  type Category,
  type NewStepInput,
  type Quest,
  type QuestSource,
  type QuestTemplate,
  type RecurrenceRule,
  type Step,
  type Tag,
  type Uuid,
} from '@/data';
import { events } from '@/services';
import {
  filledSteps,
  isRecurrenceComplete,
  makeStep,
  minutesText,
  parseMinutes,
  recurrenceFromRule,
  recurrenceInterval,
  type QuestDraft,
  type StepDraft,
} from './draft';
import { createOccurrence, patternOf } from './recurrence';

const QUEST_TABLES = [
  'quests',
  'steps',
  'recurrence_rules',
  'settings',
  'templates',
  'categories',
  'tags',
] as const;

/* --------------------------------------------------------------- helpers */

async function activeQuests(): Promise<Quest[]> {
  const rows = await db.quests.where('status').equals('active').toArray();
  return rows.filter((q) => q.deleted_at === null);
}

export async function hasActiveRoom(): Promise<boolean> {
  const settings = await getSettings();
  return canActivateAnother((await activeQuests()).length, settings.active_limit);
}

function stepInputs(steps: StepDraft[]): NewStepInput[] {
  return filledSteps(steps).map((s) => {
    const guess = parseMinutes(s.guess);
    return {
      title: s.title.trim(),
      guess_minutes: guess,
      // The offline rule always follows the latest guess.
      quick: s.quickSource === 'rule' ? isQuickByRule(guess) : s.quick,
      quick_source: s.quickSource,
    };
  });
}

function questFields(draft: QuestDraft) {
  return {
    title: draft.title.trim(),
    notes: draft.notes.trim(),
    priority: draft.priority,
    difficulty: draft.difficulty,
    guess_minutes: parseMinutes(draft.guess),
    due_date: draft.dueDate || null,
    due_time: draft.dueDate && draft.dueTime ? draft.dueTime : null,
    category_id: draft.categoryId,
    tag_ids: draft.tagIds.slice(),
  };
}

function ruleTemplate(draft: QuestDraft): RecurrenceRule['template'] {
  const f = questFields(draft);
  return {
    title: f.title,
    notes: f.notes,
    priority: f.priority,
    difficulty: f.difficulty,
    guess_minutes: f.guess_minutes,
    category_id: f.category_id,
    tag_ids: f.tag_ids,
    due_time: f.due_time,
    steps: stepInputs(draft.steps).map((s) => ({
      title: s.title,
      guess_minutes: s.guess_minutes ?? null,
      quick: s.quick ?? isQuickByRule(s.guess_minutes),
    })),
  };
}

function wantsRecurrence(draft: QuestDraft): boolean {
  return draft.recurrence.kind !== 'none' && isRecurrenceComplete(draft.recurrence);
}

/* ---------------------------------------------------------- create / edit */

export interface SaveOptions {
  /** Put it on Active right away (only when there is room). */
  activate?: boolean;
  source?: QuestSource;
  templateId?: Uuid | null;
  status?: 'inbox' | 'backlog';
}

export interface SaveResult {
  quest: Quest;
  activated: boolean;
}

/** Saves a new quest from the form. With no steps it gets one step named after the quest. */
export function createQuestFromDraft(
  draft: QuestDraft,
  options: SaveOptions = {},
): Promise<SaveResult> {
  return writeTransaction(QUEST_TABLES, async () => {
    const today = clock.today();
    const fields = questFields(draft);
    const activate = !!options.activate && (await hasActiveRoom());
    const at = clock.iso();

    if (wantsRecurrence(draft)) {
      const anchor = fields.due_date ?? today;
      const rule = await recurrenceRulesRepo.create({
        kind: draft.recurrence.kind as RecurrenceRule['kind'],
        interval: recurrenceInterval(draft.recurrence),
        weekdays: draft.recurrence.kind === 'weekdays' ? draft.recurrence.weekdays.slice() : [],
        anchor_date: anchor,
        end_date: null,
        current_quest_id: null,
        current_occurrence_date: null,
        template: ruleTemplate(draft),
        active: true,
      });
      const first = nextOccurrenceOnOrAfter(patternOf(rule), today) ?? anchor;
      const quest = await createOccurrence(rule, first, today, activate ? 'active' : 'backlog');
      return { quest, activated: activate };
    }

    const steps = stepInputs(draft.steps);
    const { quest } = await createQuest({
      ...fields,
      status: activate ? 'active' : (options.status ?? 'backlog'),
      activated_at: activate ? at : null,
      source: options.source ?? 'manual',
      template_id: options.templateId ?? null,
      steps: steps.length ? steps : undefined,
    });
    events.emitAfterCommit('quest.created', { questId: quest.id, source: quest.source });
    if (activate) events.emitAfterCommit('quest.activated', { questId: quest.id });
    return { quest, activated: activate };
  });
}

/**
 * Saves the edit form: quest fields, the step list (new, changed, reordered and removed
 * steps; done steps stay done) and the recurrence. `sortFromInbox` moves an Inbox item to
 * the backlog (or Active) and emits `inbox.sorted`.
 */
export function updateQuestFromDraft(
  questId: Uuid,
  draft: QuestDraft,
  options: { sortFromInbox?: boolean; activate?: boolean } = {},
): Promise<SaveResult> {
  return writeTransaction(QUEST_TABLES, async () => {
    const quest = await questsRepo.get(questId);
    if (!quest) throw new Error(`Unknown quest ${questId}`);
    const fields = questFields(draft);
    const at = clock.iso();
    const patch: Partial<Quest> = { ...fields, last_touched_at: at };

    let activated = false;
    if (options.sortFromInbox && quest.status === 'inbox') {
      activated = !!options.activate && (await hasActiveRoom());
      patch.status = activated ? 'active' : 'backlog';
      patch.activated_at = activated ? at : null;
    }
    // A changed due date is a fresh promise: the one overdue question stays asked, though.
    await syncSteps(questId, draft.steps, fields.title, fields.guess_minutes);
    await syncRecurrence(quest, draft, patch);
    const updated = await questsRepo.update(questId, patch);
    if (options.sortFromInbox && quest.status === 'inbox') {
      events.emitAfterCommit('inbox.sorted', { questId });
      if (activated) events.emitAfterCommit('quest.activated', { questId });
    }
    return { quest: updated, activated };
  });
}

async function syncSteps(
  questId: Uuid,
  drafts: StepDraft[],
  questTitle: string,
  questGuess: number | null,
): Promise<void> {
  const existing = await listSteps(questId);
  const filledNow = filledSteps(drafts);
  const lone = existing.length === 1 ? existing[0]! : null;
  if (filledNow.length === 0 && lone && lone.done_at === null) {
    // Keep the one automatic step (same id, so an open focus session still points at it).
    await stepsRepo.update(lone.id, {
      title: questTitle,
      guess_minutes: questGuess,
      quick: isQuickByRule(questGuess),
      quick_source: 'rule',
      position: 1,
    });
    return;
  }
  const byId = new Map(existing.map((s) => [s.id, s]));
  const kept = new Set<Uuid>();
  const filled = filledSteps(drafts);
  let position = 0;
  for (const d of filled) {
    position += 1;
    const guess = parseMinutes(d.guess);
    const quick = d.quickSource === 'rule' ? isQuickByRule(guess) : d.quick;
    const old = d.id ? byId.get(d.id) : undefined;
    if (old) {
      kept.add(old.id);
      const changes: Partial<Step> = {};
      if (old.title !== d.title.trim()) changes.title = d.title.trim();
      if (old.guess_minutes !== guess) changes.guess_minutes = guess;
      if (old.quick !== quick) changes.quick = quick;
      if (old.quick_source !== d.quickSource) changes.quick_source = d.quickSource;
      if (old.position !== position) changes.position = position;
      if (Object.keys(changes).length) await stepsRepo.update(old.id, changes);
    } else {
      await stepsRepo.create(
        newStepRow(questId, position, d.title.trim(), guess, quick, d.quickSource),
      );
    }
  }
  for (const s of existing) if (!kept.has(s.id)) await stepsRepo.remove(s.id);
  if (filled.length === 0) {
    await stepsRepo.create(
      newStepRow(questId, 1, questTitle, questGuess, isQuickByRule(questGuess), 'rule'),
    );
  }
}

function newStepRow(
  questId: Uuid,
  position: number,
  title: string,
  guess: number | null,
  quick: boolean,
  quickSource: Step['quick_source'],
) {
  return {
    quest_id: questId,
    title,
    position,
    guess_minutes: guess,
    quick,
    quick_source: quickSource,
    done_at: null,
    actual_ms: 0,
    completed_without_timer: false,
    no_timer_confirmed: false,
    no_timer_warned_at: null,
  };
}

async function syncRecurrence(quest: Quest, draft: QuestDraft, patch: Partial<Quest>) {
  const rule = quest.recurrence_rule_id
    ? await recurrenceRulesRepo.get(quest.recurrence_rule_id)
    : undefined;
  const today = clock.today();
  if (!wantsRecurrence(draft)) {
    if (rule) {
      await recurrenceRulesRepo.update(rule.id, { active: false, current_quest_id: null });
      patch.recurrence_rule_id = null;
      patch.occurrence_date = null;
    }
    return;
  }
  const kind = draft.recurrence.kind as RecurrenceRule['kind'];
  const shape = {
    kind,
    interval: recurrenceInterval(draft.recurrence),
    weekdays: kind === 'weekdays' ? draft.recurrence.weekdays.slice() : [],
  };
  if (rule && rule.active) {
    await recurrenceRulesRepo.update(rule.id, { ...shape, template: ruleTemplate(draft) });
    return;
  }
  const anchor = patch.due_date ?? today;
  const occurrence = nextOccurrenceOnOrAfter(
    { kind, anchorDate: anchor, interval: shape.interval, weekdays: shape.weekdays },
    today,
  );
  const created = await recurrenceRulesRepo.create({
    ...shape,
    anchor_date: anchor,
    end_date: null,
    current_quest_id: quest.id,
    current_occurrence_date: occurrence ?? anchor,
    template: ruleTemplate(draft),
    active: true,
  });
  patch.recurrence_rule_id = created.id;
  patch.occurrence_date = occurrence ?? anchor;
  if (!patch.due_date) patch.due_date = occurrence ?? anchor;
}

function isAutoStep(quest: Quest, steps: Step[]): boolean {
  const only = steps.length === 1 ? steps[0]! : null;
  return (
    !!only &&
    only.title === quest.title &&
    only.done_at === null &&
    only.actual_ms === 0 &&
    only.quick_source === 'rule'
  );
}

/** The form draft for an existing quest. */
export async function draftFromQuest(questId: Uuid): Promise<QuestDraft | null> {
  const quest = await questsRepo.get(questId);
  if (!quest) return null;
  const steps = await listSteps(questId);
  const rule = quest.recurrence_rule_id
    ? await recurrenceRulesRepo.get(quest.recurrence_rule_id)
    : undefined;
  return {
    title: quest.title,
    notes: quest.notes,
    priority: quest.priority,
    difficulty: quest.difficulty,
    guess: minutesText(quest.guess_minutes),
    dueDate: quest.due_date ?? '',
    dueTime: quest.due_time ?? '',
    categoryId: quest.category_id,
    tagIds: quest.tag_ids.slice(),
    // The automatic step named after the quest is not shown as a real step: adding steps
    // replaces it, and leaving the list empty keeps it (renamed with the quest).
    steps: (isAutoStep(quest, steps) ? [] : steps).map((s) => ({
      ...makeStep(s.title, s.guess_minutes, s.quick, s.quick_source),
      id: s.id,
      done: s.done_at !== null,
    })),
    recurrence: recurrenceFromRule(rule),
  };
}

/* ------------------------------------------------------- active and swap */

export type ActivateResult = 'activated' | 'already' | 'full';

/** Puts a quest on Active, or reports that the swap sheet is needed. */
export function activateQuest(questId: Uuid): Promise<ActivateResult> {
  return writeTransaction(QUEST_TABLES, async () => {
    const quest = await questsRepo.get(questId);
    if (!quest) throw new Error(`Unknown quest ${questId}`);
    if (quest.status === 'active') return 'already';
    if (!(await hasActiveRoom())) return 'full';
    const at = clock.iso();
    await questsRepo.update(questId, { status: 'active', activated_at: at, last_touched_at: at });
    if (quest.status === 'inbox') events.emitAfterCommit('inbox.sorted', { questId });
    events.emitAfterCommit('quest.activated', { questId });
    return 'activated';
  });
}

/** One tap on the swap sheet: `outId` rests in the backlog (progress kept), `inId` becomes active. */
export function swapActive(outId: Uuid, inId: Uuid): Promise<void> {
  return writeTransaction(QUEST_TABLES, async () => {
    const out = await questsRepo.get(outId);
    const incoming = await questsRepo.get(inId);
    if (!out || !incoming) throw new Error('Unknown quest');
    const at = clock.iso();
    if (out.status === 'active') {
      await questsRepo.update(outId, { status: 'backlog' });
      events.emitAfterCommit('quest.deactivated', { questId: outId });
    }
    if (incoming.status !== 'active') {
      await questsRepo.update(inId, { status: 'active', activated_at: at, last_touched_at: at });
      if (incoming.status === 'inbox') events.emitAfterCommit('inbox.sorted', { questId: inId });
      events.emitAfterCommit('quest.activated', { questId: inId });
    }
  });
}

export function deactivateQuest(questId: Uuid): Promise<void> {
  return writeTransaction(QUEST_TABLES, async () => {
    const quest = await questsRepo.get(questId);
    if (!quest || quest.status !== 'active') return;
    await questsRepo.update(questId, { status: 'backlog' });
    events.emitAfterCommit('quest.deactivated', { questId });
  });
}

/** Inbox item to backlog in one tap. */
export function moveInboxToBacklog(questId: Uuid): Promise<void> {
  return writeTransaction(QUEST_TABLES, async () => {
    const quest = await questsRepo.get(questId);
    if (!quest || quest.status !== 'inbox') return;
    await questsRepo.update(questId, { status: 'backlog', last_touched_at: clock.iso() });
    events.emitAfterCommit('inbox.sorted', { questId });
  });
}

/* --------------------------------------------------- archive and delete */

export function archiveQuest(questId: Uuid): Promise<void> {
  return writeTransaction(QUEST_TABLES, async () => {
    const quest = await questsRepo.get(questId);
    if (!quest || quest.status === 'archived') return;
    await questsRepo.update(questId, { status: 'archived', archived_at: clock.iso() });
    events.emitAfterCommit('quest.archived', { questId });
  });
}

/** Archived (or done) back to the backlog. */
export function restoreQuest(questId: Uuid): Promise<void> {
  return writeTransaction(QUEST_TABLES, async () => {
    const quest = await questsRepo.get(questId);
    if (!quest || quest.status !== 'archived') return;
    await questsRepo.update(questId, {
      status: 'backlog',
      archived_at: null,
      last_touched_at: clock.iso(),
    });
  });
}

/** Soft delete of the quest and its steps. A recurring series stops with it. */
export function deleteQuest(questId: Uuid): Promise<void> {
  return writeTransaction(QUEST_TABLES, async () => {
    const quest = await questsRepo.get(questId);
    if (!quest) return;
    for (const s of await listSteps(questId)) await stepsRepo.remove(s.id);
    await questsRepo.remove(questId);
    if (quest.recurrence_rule_id) {
      const rule = await recurrenceRulesRepo.get(quest.recurrence_rule_id);
      if (rule && rule.current_quest_id === questId)
        await recurrenceRulesRepo.update(rule.id, { active: false });
    }
  });
}

/** Undo for `deleteQuest` (the toast's Undo button). */
export function undoDeleteQuest(questId: Uuid): Promise<void> {
  return writeTransaction(QUEST_TABLES, async () => {
    const quest = await questsRepo.getAny(questId);
    if (!quest || quest.deleted_at === null) return;
    const deletedAt = quest.deleted_at;
    await questsRepo.restore(questId);
    const steps = await db.steps.where('quest_id').equals(questId).toArray();
    for (const s of steps) if (s.deleted_at === deletedAt) await stepsRepo.restore(s.id);
    if (quest.recurrence_rule_id) {
      const rule = await recurrenceRulesRepo.get(quest.recurrence_rule_id);
      if (rule && rule.current_quest_id === questId)
        await recurrenceRulesRepo.update(rule.id, { active: true });
    }
  });
}

/* ------------------------------------------------------------------ boss */

export function turnIntoBoss(questId: Uuid): Promise<boolean> {
  return writeTransaction(QUEST_TABLES, async () => {
    const quest = await questsRepo.get(questId);
    if (!quest || !isBossEligible(quest, clock.now())) return false;
    const at = clock.iso();
    await questsRepo.update(questId, { is_boss: true, boss_started_at: at, last_touched_at: at });
    events.emitAfterCommit('quest.became_boss', { questId });
    return true;
  });
}

/* --------------------------------------------------------------- overdue */

/** The one answer to "Can this still be done?". Yes keeps it (maybe with a new date), No archives. */
export function answerOverdue(
  questId: Uuid,
  answer: 'keep' | 'archive',
  newDueDate?: string | null,
): Promise<void> {
  return writeTransaction(QUEST_TABLES, async () => {
    const quest = await questsRepo.get(questId);
    if (!quest) return;
    const at = clock.iso();
    const patch: Partial<Quest> = { overdue_asked_at: at, overdue_answer: answer };
    if (answer === 'archive') {
      patch.status = 'archived';
      patch.archived_at = at;
    } else if (newDueDate) {
      patch.due_date = newDueDate;
    }
    await questsRepo.update(questId, patch);
    events.emitAfterCommit('quest.overdue_answered', { questId, answer });
    if (answer === 'archive') events.emitAfterCommit('quest.archived', { questId });
  });
}

/** Closing the prompt without answering still counts as asked: it never comes back. */
export async function dismissOverdue(questId: Uuid): Promise<void> {
  const quest = await questsRepo.get(questId);
  if (!quest || quest.overdue_asked_at) return;
  await questsRepo.update(questId, { overdue_asked_at: clock.iso() });
}

/* --------------------------------------------------------- quick capture */

export function quickCapture(title: string): Promise<Quest> {
  return writeTransaction(QUEST_TABLES, async () => {
    const { quest } = await createQuest({
      title: title.trim(),
      status: 'inbox',
      source: 'quick_capture',
    });
    events.emitAfterCommit('quest.created', { questId: quest.id, source: 'quick_capture' });
    return quest;
  });
}

/* ----------------------------------------------------------------- steps */

/** Whether any focus session ran on this step (no-timer warning). */
export async function hadFocusSession(stepId: Uuid): Promise<boolean> {
  const rows = await db.focus_sessions.where('step_id').equals(stepId).toArray();
  return rows.some((s) => s.deleted_at === null && s.kind === 'focus');
}

export function markNoTimerWarned(stepId: Uuid): Promise<Step> {
  return stepsRepo.update(stepId, { no_timer_warned_at: clock.iso() });
}

/** The step to start focus on: the first open one. */
export async function firstOpenStep(questId: Uuid): Promise<Step | null> {
  return (await listSteps(questId)).find((s) => s.done_at === null) ?? null;
}

/** "I'm stuck": replaces an open step with smaller ones in the same place. */
export function splitStepInto(
  stepId: Uuid,
  parts: { title: string; guessMinutes: number | null; quick: boolean }[],
): Promise<Step[]> {
  return writeTransaction(QUEST_TABLES, async () => {
    const step = await stepsRepo.get(stepId);
    if (!step || step.done_at !== null || parts.length === 0) return [];
    const siblings = await listSteps(step.quest_id);
    const index = siblings.findIndex((s) => s.id === stepId);
    const next = siblings[index + 1];
    const from = step.position;
    const span = next ? next.position - from : parts.length;
    const created: Step[] = [];
    for (const [i, p] of parts.entries()) {
      created.push(
        await stepsRepo.create(
          newStepRow(
            step.quest_id,
            from + (span * i) / parts.length,
            p.title,
            p.guessMinutes,
            p.quick,
            'ai',
          ),
        ),
      );
    }
    await stepsRepo.remove(stepId);
    await questsRepo.update(step.quest_id, { last_touched_at: clock.iso() });
    return created;
  });
}

/**
 * AI light classification of manually typed steps (plan section 4): flags steps whose
 * `quick` still comes from the offline rule. Runs after saving, so saving never waits.
 */
export async function applyQuickClassification(
  questId: Uuid,
  classify: (steps: { title: string; guessMinutes: number | null }[]) => Promise<boolean[]>,
): Promise<void> {
  const steps = (await listSteps(questId)).filter(
    (s) => s.quick_source === 'rule' && s.done_at === null,
  );
  if (steps.length === 0) return;
  const flags = await classify(
    steps.map((s) => ({ title: s.title, guessMinutes: s.guess_minutes })),
  );
  if (flags.length !== steps.length) return;
  await writeTransaction(['steps'], async () => {
    for (const [i, s] of steps.entries()) {
      const fresh = await stepsRepo.get(s.id);
      if (!fresh || fresh.quick_source !== 'rule' || fresh.done_at !== null) continue;
      await stepsRepo.update(s.id, { quick: flags[i]!, quick_source: 'ai' });
    }
  });
}

/* ------------------------------------------------------------- templates */

export async function saveAsTemplate(questId: Uuid): Promise<QuestTemplate> {
  return writeTransaction(QUEST_TABLES, async () => {
    const quest = await questsRepo.get(questId);
    if (!quest) throw new Error(`Unknown quest ${questId}`);
    const steps = await listSteps(questId);
    return templatesRepo.create({
      title: quest.title,
      notes: quest.notes,
      priority: quest.priority,
      difficulty: quest.difficulty,
      guess_minutes: quest.guess_minutes,
      category_id: quest.category_id,
      tag_ids: quest.tag_ids.slice(),
      // The automatic step named after the quest is not shown as a real step: adding steps
    // replaces it, and leaving the list empty keeps it (renamed with the quest).
    steps: (isAutoStep(quest, steps) ? [] : steps).map((s) => ({ title: s.title, guess_minutes: s.guess_minutes, quick: s.quick })),
    });
  });
}

export function draftFromTemplate(t: QuestTemplate, base: QuestDraft): QuestDraft {
  return {
    ...base,
    title: t.title,
    notes: t.notes,
    priority: t.priority,
    difficulty: t.difficulty,
    guess: minutesText(t.guess_minutes),
    categoryId: t.category_id,
    tagIds: t.tag_ids.slice(),
    steps: t.steps.map((s) =>
      makeStep(
        s.title,
        s.guess_minutes,
        s.quick,
        s.quick === isQuickByRule(s.guess_minutes) ? 'rule' : 'user',
      ),
    ),
  };
}

export function deleteTemplate(id: Uuid): Promise<void> {
  return templatesRepo.remove(id);
}

/* ---------------------------------------------------- categories and tags */

export const CATEGORY_COLORS = [
  'sky',
  'sage',
  'rose',
  'honey',
  'lavender',
  'clay',
  'teal',
  'slate',
] as const;

export async function createCategory(input: Pick<Category, 'name' | 'color' | 'icon'>) {
  const all = await categoriesRepo.list();
  const position = all.reduce((m, c) => Math.max(m, c.position), 0) + 1;
  return categoriesRepo.create({ ...input, name: input.name.trim(), name_key: null, position });
}

export function updateCategory(
  id: Uuid,
  patch: Partial<Pick<Category, 'name' | 'color' | 'icon'>>,
) {
  return categoriesRepo.update(id, {
    ...patch,
    ...(patch.name !== undefined && { name: patch.name.trim() }),
  });
}

/** Deletes a category; its quests simply have no category afterwards. */
export function deleteCategory(id: Uuid): Promise<void> {
  return writeTransaction(QUEST_TABLES, async () => {
    const quests = await db.quests.where('category_id').equals(id).toArray();
    for (const q of quests)
      if (q.deleted_at === null) await questsRepo.update(q.id, { category_id: null });
    const templates = await templatesRepo.list((t) => t.category_id === id);
    for (const t of templates) await templatesRepo.update(t.id, { category_id: null });
    await categoriesRepo.remove(id);
  });
}

/** Finds a tag by name (case-insensitive) or creates it. */
export async function ensureTag(name: string): Promise<Tag> {
  const clean = name.trim().replace(/^#/, '');
  const existing = await tagsRepo.list(
    (t) => t.name.toLocaleLowerCase() === clean.toLocaleLowerCase(),
  );
  if (existing[0]) return existing[0];
  return tagsRepo.create({ name: clean, color: null });
}

export function renameTag(id: Uuid, name: string) {
  return tagsRepo.update(id, { name: name.trim().replace(/^#/, '') });
}

/** Deletes a tag and takes it off every quest and template. */
export function deleteTag(id: Uuid): Promise<void> {
  return writeTransaction(QUEST_TABLES, async () => {
    const quests = await db.quests.where('tag_ids').equals(id).toArray();
    for (const q of quests)
      if (q.deleted_at === null)
        await questsRepo.update(q.id, { tag_ids: q.tag_ids.filter((t) => t !== id) });
    const templates = await templatesRepo.list((t) => t.tag_ids.includes(id));
    for (const t of templates)
      await templatesRepo.update(t.id, { tag_ids: t.tag_ids.filter((x) => x !== id) });
    await tagsRepo.remove(id);
  });
}
