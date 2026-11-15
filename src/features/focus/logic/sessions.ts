/**
 * Focus session operations. Every write goes through the repositories inside one
 * transaction per player action, and events are emitted only after the commit.
 *
 * Session lifecycle:
 *   start -> (pause <-> resume)* -> end(reason)
 * A session ends when the timer runs out (`timer_done` / `ended_while_away`, at the moment
 * it reached zero), when the step is done (`step_done`), when the player stops
 * (`stopped`), or when its step disappeared (`abandoned`). On every end of a focus session
 * its focused time is added to `steps.actual_ms` and the focus bonus is granted.
 */
import {
  clock,
  createQuest,
  db,
  distractionNotesRepo,
  focusSessionsRepo,
  powerUpActivationsRepo,
  getDeviceId,
  getSettings,
  listSteps,
  localMeta,
  sessionToTimerState,
  stepsRepo,
  touchQuest,
  writeTransaction,
  type DistractionKind,
  type FocusSession,
  type SessionEndReason,
  type SessionKind,
  type Uuid,
} from '@/data';
import { timerPhase } from '@/domain/timer';
import {
  completeStep,
  events,
  grantReward,
  REWARD_TABLES,
  type CompleteStepResult,
  type GrantResult,
} from '@/services';
import {
  clampMinutes,
  closeAway,
  DEFAULT_BREAK_MINUTES,
  DEFAULT_FOCUS_MINUTES,
  endingPatch,
  openAway,
  type Awaiting,
} from './machine';

/** Tables any focus action may touch (rewards and progress included). */
export const FOCUS_TABLES = [...REWARD_TABLES, 'distraction_notes', 'local_meta'] as const;

export const AWAITING_KEY = 'focus.awaiting';

const run = <T>(fn: () => Promise<T>) => writeTransaction(FOCUS_TABLES, fn);

/** The open session (not ended), newest first if several exist (e.g. after a sync merge). */
export async function getOpenSession(): Promise<FocusSession | null> {
  const open = (await db.focus_sessions.toArray()).filter(
    (s) => s.deleted_at === null && s.ended_at === null,
  );
  open.sort((a, b) => (a.started_at < b.started_at ? 1 : -1));
  return open[0] ?? null;
}

export async function getAwaiting(): Promise<Awaiting | null> {
  const value = await localMeta.get<Awaiting>(AWAITING_KEY);
  return value && typeof value.session_id === 'string' ? value : null;
}

export function clearAwaiting(): Promise<void> {
  return localMeta.remove(AWAITING_KEY);
}

async function requireSession(id: Uuid): Promise<FocusSession> {
  const s = await focusSessionsRepo.get(id);
  if (!s) throw new Error(`Unknown focus session ${id}`);
  return s;
}

export interface StartOptions {
  stepId: Uuid;
  /** Timer length; the player's default (focus or break) when absent. */
  minutes?: number | null;
  kind?: SessionKind;
}

/**
 * Creates and starts a session right away. If a session is already open, nothing new is
 * created and that one is returned (`created: false`): one open session at a time.
 */
export async function startSession(
  options: StartOptions,
): Promise<{ session: FocusSession; created: boolean }> {
  const kind = options.kind ?? 'focus';
  const deviceId = await getDeviceId();
  const settings = await getSettings();
  return run(async () => {
    const open = await getOpenSession();
    if (open) return { session: open, created: false };
    const step = await stepsRepo.get(options.stepId);
    if (!step) throw new Error(`Unknown step ${options.stepId}`);
    const fallback =
      kind === 'break'
        ? (settings.break_minutes ?? DEFAULT_BREAK_MINUTES)
        : (settings.focus_minutes ?? DEFAULT_FOCUS_MINUTES);
    const minutes = clampMinutes(options.minutes ?? fallback, fallback);
    // A double-XP potion drunk with no session open waits for the next focus session: claim
    // it here, in the same transaction, so the session is doubled from its first moment and
    // the potion is used exactly once (Game's own apply then finds nothing pending).
    const potion =
      kind === 'focus'
        ? (
            await powerUpActivationsRepo.list(
              (a) =>
                a.type === 'double_xp_potion' &&
                a.target_type === 'focus_session' &&
                a.target_id === null,
            )
          )[0]
        : undefined;
    const session = await focusSessionsRepo.create({
      kind,
      quest_id: step.quest_id,
      step_id: step.id,
      started_at: clock.iso(),
      planned_ms: minutes * 60_000,
      pauses: [],
      away: [],
      distractions: [],
      ended_at: null,
      end_reason: null,
      focused_ms: 0,
      away_ms: 0,
      paused_ms: 0,
      double_xp: !!potion,
      device_id: deviceId,
    });
    if (potion) await powerUpActivationsRepo.update(potion.id, { target_id: session.id });
    if (kind === 'focus' && (await db.quests.get(step.quest_id))?.deleted_at === null) {
      await touchQuest(step.quest_id);
    }
    await db.local_meta.delete(AWAITING_KEY);
    events.emitAfterCommit('session.started', {
      sessionId: session.id,
      questId: session.quest_id,
      stepId: session.step_id,
      kind,
    });
    return { session, created: true };
  });
}

/** A break after a focus session, for the same step. */
export function startBreak(afterSessionId: Uuid) {
  return focusSessionsRepo.get(afterSessionId).then((prev) => {
    if (!prev?.step_id) throw new Error('A break needs a step');
    return startSession({ stepId: prev.step_id, kind: 'break' });
  });
}

export async function pauseSession(id: Uuid): Promise<FocusSession> {
  return run(async () => {
    const s = await requireSession(id);
    if (s.ended_at !== null || s.pauses.some((p) => p.end === null)) return s;
    if (timerPhase(sessionToTimerState(s), clock.now()) !== 'running') return s;
    return focusSessionsRepo.update(id, {
      pauses: [...s.pauses, { start: clock.iso(), end: null }],
    });
  });
}

export async function resumeSession(id: Uuid): Promise<FocusSession> {
  return run(async () => {
    const s = await requireSession(id);
    if (s.ended_at !== null || !s.pauses.some((p) => p.end === null)) return s;
    const at = clock.iso();
    return focusSessionsRepo.update(id, {
      pauses: s.pauses.map((p) => (p.end === null ? { ...p, end: at } : p)),
    });
  });
}

/** Changes the length of an open session. The start time stays; only the target moves. */
export async function setSessionMinutes(id: Uuid, minutes: number): Promise<FocusSession> {
  return run(async () => {
    const s = await requireSession(id);
    if (s.ended_at !== null) return s;
    return focusSessionsRepo.update(id, { planned_ms: clampMinutes(minutes) * 60_000 });
  });
}

export interface EndResult {
  session: FocusSession;
  /** False when it had already ended (nothing changed). */
  changed: boolean;
  /** The focus bonus (null for breaks, or when nothing was earned). */
  bonus: GrantResult | null;
}

/**
 * Ends a session at `at` (default now). Saves the totals, adds focused time to the step,
 * grants the focus bonus (after `focused_ms` is saved), emits `session.ended`.
 * With `awaitChoice`, the end is remembered on this device so the shell can offer the
 * "what's next?" choices until the player picks one.
 */
export async function endSession(
  id: Uuid,
  reason: SessionEndReason,
  options: { at?: number; awaitChoice?: boolean } = {},
): Promise<EndResult> {
  return run(async () => {
    const s = await requireSession(id);
    if (s.ended_at !== null) return { session: s, changed: false, bonus: null };
    const now = clock.now();
    const endAt = Math.max(Date.parse(s.started_at), Math.min(options.at ?? now, now));
    const patch = endingPatch(sessionToTimerState(s), s, endAt, reason);
    const ended = await focusSessionsRepo.update(id, patch);
    let bonus: GrantResult | null = null;
    if (ended.kind === 'focus') {
      if (ended.step_id && ended.focused_ms > 0) {
        const step = await stepsRepo.get(ended.step_id);
        if (step) {
          await stepsRepo.update(step.id, { actual_ms: (step.actual_ms || 0) + ended.focused_ms });
        }
      }
      const grant = await grantReward({ kind: 'focus_bonus', sessionId: id });
      bonus = grant.total.xp > 0 ? grant : null;
    }
    if (options.awaitChoice) {
      await db.local_meta.put({
        key: AWAITING_KEY,
        value: { session_id: id, at: patch.ended_at ?? clock.iso() } satisfies Awaiting,
      });
    }
    events.emitAfterCommit('session.ended', {
      sessionId: id,
      questId: ended.quest_id,
      stepId: ended.step_id,
      kind: ended.kind,
      focusedMs: ended.focused_ms,
      reason,
    });
    return { session: ended, changed: true, bonus };
  });
}

/** Ends whatever is open (focus or break) as stopped. Used before switching steps. */
export async function stopOpenSession(): Promise<EndResult | null> {
  const open = await getOpenSession();
  return open ? endSession(open.id, 'stopped') : null;
}

/**
 * "Done": the step is finished inside this session. Ends the session if still open
 * (`step_done`), then completes the step with the session id (rewards, quest finish).
 * Works after the timer ended too, so Done is always one tap.
 */
export async function completeStepInSession(
  sessionId: Uuid,
): Promise<{ end: EndResult; completion: CompleteStepResult | null }> {
  return run(async () => {
    const s = await requireSession(sessionId);
    const end =
      s.ended_at === null
        ? await endSession(sessionId, 'step_done')
        : { session: s, changed: false, bonus: null };
    await db.local_meta.delete(AWAITING_KEY);
    const completion = s.step_id ? await completeStep(s.step_id, { sessionId }) : null;
    return { end, completion };
  });
}

/** Adds a distraction event to a session (any state). */
async function pushDistraction(
  s: FocusSession,
  kind: DistractionKind,
  noteId: Uuid | null,
): Promise<FocusSession> {
  return focusSessionsRepo.update(s.id, {
    distractions: [...s.distractions, { at: clock.iso(), kind, note_id: noteId }],
  });
}

/**
 * "I got distracted": parks the thought as an Inbox quest (when there is text), stores the
 * note, logs the distraction on the session and emits `distraction.logged`.
 */
export async function logDistraction(input: {
  sessionId: Uuid;
  text: string;
}): Promise<{ noteId: Uuid | null; inboxQuestId: Uuid | null }> {
  const text = input.text.trim();
  return run(async () => {
    const s = await requireSession(input.sessionId);
    let noteId: Uuid | null = null;
    let inboxQuestId: Uuid | null = null;
    if (text) {
      const { quest } = await createQuest({ title: text, status: 'inbox', source: 'distraction' });
      inboxQuestId = quest.id;
      const note = await distractionNotesRepo.create({
        text,
        session_id: s.id,
        quest_id: s.quest_id,
        step_id: s.step_id,
        captured_at: clock.iso(),
        inbox_quest_id: quest.id,
      });
      noteId = note.id;
    }
    await pushDistraction(s, 'button', noteId);
    events.emitAfterCommit('distraction.logged', { sessionId: s.id, noteId });
    return { noteId, inboxQuestId };
  });
}

/** Logs a left-the-app or idle distraction on a session. Never penalized. */
export async function logSessionEvent(
  sessionId: Uuid,
  kind: Exclude<DistractionKind, 'button'>,
): Promise<void> {
  await run(async () => {
    const s = await focusSessionsRepo.get(sessionId);
    if (s) await pushDistraction(s, kind, null);
  });
}

/** The app was hidden or lost focus: opens an away period on the open focus session. */
export async function markAway(sessionId: Uuid, at = clock.iso()): Promise<FocusSession | null> {
  return run(async () => {
    const s = await focusSessionsRepo.get(sessionId);
    if (!s || s.ended_at !== null || s.kind !== 'focus') return null;
    if (s.away.some((a) => a.end === null)) return s;
    return focusSessionsRepo.update(sessionId, { away: openAway(s.away, at) });
  });
}

/** The player is back: closes the open away period. Returns how long it lasted. */
export async function markBack(sessionId: Uuid, at = clock.iso()): Promise<number> {
  return run(async () => {
    const s = await focusSessionsRepo.get(sessionId);
    if (!s || s.ended_at !== null) return 0;
    const open = s.away.find((a) => a.end === null);
    if (!open) return 0;
    await focusSessionsRepo.update(sessionId, { away: closeAway(s.away, at) });
    return Math.max(0, Date.parse(at) - Date.parse(open.start));
  });
}

/* ------------------------------------------------------------ summaries */

export interface RewardLine {
  xp: number;
  gold: number;
}

/**
 * What a session paid, read back from the ledger so it survives a reload: the step reward,
 * bonus gold, the focus bonus, and the quest finish (with boss bonus).
 */
export async function sessionRewards(
  session: Pick<FocusSession, 'id' | 'step_id' | 'quest_id'>,
): Promise<{
  step: RewardLine;
  loot: number;
  focus: number;
  quest: RewardLine;
  doubleXp: boolean;
}> {
  const keys = [
    `focus:${session.id}`,
    ...(session.step_id ? [`step:${session.step_id}`, `loot:step:${session.step_id}`] : []),
    ...(session.quest_id ? [`quest:${session.quest_id}`, `boss:${session.quest_id}`] : []),
  ];
  const rows = await db.ledger_events.where('dedupe_key').anyOf(keys).toArray();
  const by = (k: string) => rows.find((r) => r.dedupe_key === k && r.deleted_at === null);
  const step = by(`step:${session.step_id}`);
  const quest = by(`quest:${session.quest_id}`);
  const boss = by(`boss:${session.quest_id}`);
  return {
    step: { xp: step?.xp ?? 0, gold: step?.gold ?? 0 },
    loot: by(`loot:step:${session.step_id}`)?.gold ?? 0,
    focus: by(`focus:${session.id}`)?.xp ?? 0,
    quest: { xp: (quest?.xp ?? 0) + (boss?.xp ?? 0), gold: (quest?.gold ?? 0) + (boss?.gold ?? 0) },
    doubleXp: !!step?.meta?.double_xp,
  };
}

/** Steps of the session's quest, in order (for current / next step). */
export function questSteps(questId: Uuid | null) {
  return questId ? listSteps(questId) : Promise.resolve([]);
}
