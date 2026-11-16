import { beforeEach, describe, expect, it } from 'vitest';
import {
  createQuest,
  db,
  ensureLocalData,
  focusSessionsRepo,
  ledgerTotals,
  powerUpActivationsRepo,
  listQuestsByStatus,
  setClock,
  stepsRepo,
  updateSettings,
} from '@/data';
import { configureRewards, events, type AppEvents } from '@/services';
import { resetAll } from '@/test/db';
import {
  AWAITING_KEY,
  completeStepInSession,
  endSession,
  getAwaiting,
  getOpenSession,
  logDistraction,
  logSessionEvent,
  markAway,
  markBack,
  pauseSession,
  resumeSession,
  sessionRewards,
  setSessionMinutes,
  startBreak,
  startSession,
} from './sessions';

const MIN = 60_000;
const T0 = Date.parse('2026-03-10T09:00:00.000Z');
let now = T0;
const at = (ms: number) => {
  now = ms;
};

beforeEach(async () => {
  await resetAll();
  now = T0;
  setClock(() => now);
  await ensureLocalData();
  configureRewards({ rareItemIds: () => [] });
});

function record<K extends keyof AppEvents>(name: K) {
  const seen: AppEvents[K][] = [];
  events.on(name, (p) => seen.push(p));
  return seen;
}

async function seed(steps = 2) {
  const { quest, steps: rows } = await createQuest({
    title: 'Essay',
    status: 'active',
    difficulty: 'C',
    steps: Array.from({ length: steps }, (_, i) => ({
      title: `Step ${i + 1}`,
      guess_minutes: 10,
    })),
  });
  return { quest, steps: rows };
}

describe('starting', () => {
  it('starts with the default length and emits session.started', async () => {
    const started = record('session.started');
    const { steps } = await seed();
    const { session, created } = await startSession({ stepId: steps[0]!.id });
    expect(created).toBe(true);
    expect(session.planned_ms).toBe(25 * MIN);
    expect(session.started_at).toBe(new Date(T0).toISOString());
    expect(session.quest_id).toBe(steps[0]!.quest_id);
    expect(started).toEqual([
      { sessionId: session.id, questId: session.quest_id, stepId: steps[0]!.id, kind: 'focus' },
    ]);
    expect((await db.quests.get(session.quest_id!))?.last_touched_at).not.toBeNull();
  });

  it('honors minutes and the player default', async () => {
    const { steps } = await seed();
    await updateSettings({ focus_minutes: 45 });
    const a = await startSession({ stepId: steps[0]!.id, minutes: 5 });
    expect(a.session.planned_ms).toBe(5 * MIN);
    await endSession(a.session.id, 'stopped');
    const b = await startSession({ stepId: steps[0]!.id });
    expect(b.session.planned_ms).toBe(45 * MIN);
  });

  it('never opens a second session', async () => {
    const { steps } = await seed();
    const a = await startSession({ stepId: steps[0]!.id });
    const b = await startSession({ stepId: steps[1]!.id });
    expect(b.created).toBe(false);
    expect(b.session.id).toBe(a.session.id);
    expect(await db.focus_sessions.count()).toBe(1);
  });

  it('a break uses the break length and the same step', async () => {
    const { steps } = await seed();
    const a = await startSession({ stepId: steps[0]!.id });
    await endSession(a.session.id, 'timer_done', { at: T0 + 25 * MIN });
    const br = await startBreak(a.session.id);
    expect(br.session.kind).toBe('break');
    expect(br.session.planned_ms).toBe(5 * MIN);
    expect(br.session.step_id).toBe(steps[0]!.id);
  });
});

describe('pause, resume, length', () => {
  it('pauses and resumes from stored timestamps', async () => {
    const { steps } = await seed();
    const { session } = await startSession({ stepId: steps[0]!.id });
    at(T0 + 5 * MIN);
    await pauseSession(session.id);
    await pauseSession(session.id); // idempotent
    at(T0 + 8 * MIN);
    const resumed = await resumeSession(session.id);
    expect(resumed.pauses).toEqual([
      { start: new Date(T0 + 5 * MIN).toISOString(), end: new Date(T0 + 8 * MIN).toISOString() },
    ]);
    at(T0 + 10 * MIN);
    const { session: ended } = await endSession(session.id, 'stopped');
    expect(ended.focused_ms).toBe(7 * MIN);
    expect(ended.paused_ms).toBe(3 * MIN);
  });

  it('changes the planned length of an open session', async () => {
    const { steps } = await seed();
    const { session } = await startSession({ stepId: steps[0]!.id });
    expect((await setSessionMinutes(session.id, 10)).planned_ms).toBe(10 * MIN);
    expect((await setSessionMinutes(session.id, 999)).planned_ms).toBe(240 * MIN);
  });
});

describe('ending', () => {
  it('saves totals, adds actual time to the step, grants the focus bonus, emits once', async () => {
    const ended = record('session.ended');
    const { steps } = await seed();
    const { session } = await startSession({ stepId: steps[0]!.id });
    at(T0 + 40 * MIN);
    const r = await endSession(session.id, 'timer_done', { at: T0 + 25 * MIN, awaitChoice: true });
    expect(r.session.ended_at).toBe(new Date(T0 + 25 * MIN).toISOString());
    expect(r.session.focused_ms).toBe(25 * MIN);
    expect(r.bonus?.total.xp).toBe(5);
    expect((await stepsRepo.get(steps[0]!.id))?.actual_ms).toBe(25 * MIN);
    expect(await ledgerTotals()).toEqual({ xp: 5, gold: 0 });
    expect(ended).toHaveLength(1);
    expect(ended[0]).toMatchObject({ reason: 'timer_done', focusedMs: 25 * MIN });
    expect(await getAwaiting()).toEqual({ session_id: session.id, at: r.session.ended_at });

    // Ending twice changes nothing.
    const again = await endSession(session.id, 'stopped');
    expect(again.changed).toBe(false);
    expect(ended).toHaveLength(1);
    expect((await stepsRepo.get(steps[0]!.id))?.actual_ms).toBe(25 * MIN);
  });

  it('sessions of the same step accumulate', async () => {
    const { steps } = await seed();
    const a = await startSession({ stepId: steps[0]!.id });
    at(T0 + 12 * MIN);
    await endSession(a.session.id, 'stopped');
    const b = await startSession({ stepId: steps[0]!.id });
    at(T0 + 20 * MIN);
    await endSession(b.session.id, 'stopped');
    expect((await stepsRepo.get(steps[0]!.id))?.actual_ms).toBe(20 * MIN);
  });

  it('stopping keeps focused time and pays the bonus, with no penalty', async () => {
    const { steps } = await seed();
    const { session } = await startSession({ stepId: steps[0]!.id });
    at(T0 + 11 * MIN);
    const r = await endSession(session.id, 'stopped');
    expect(r.session.focused_ms).toBe(11 * MIN);
    expect(r.bonus?.total.xp).toBe(2);
    expect((await ledgerTotals()).xp).toBe(2);
  });

  it('breaks add no actual time and no bonus', async () => {
    const { steps } = await seed();
    const a = await startSession({ stepId: steps[0]!.id, kind: 'break' });
    at(T0 + 5 * MIN);
    const r = await endSession(a.session.id, 'timer_done');
    expect(r.bonus).toBeNull();
    expect((await stepsRepo.get(steps[0]!.id))?.actual_ms).toBe(0);
  });

  it('honors double XP set on the session', async () => {
    const { steps } = await seed();
    const { session } = await startSession({ stepId: steps[0]!.id });
    await focusSessionsRepo.update(session.id, { double_xp: true });
    at(T0 + 25 * MIN);
    const r = await endSession(session.id, 'timer_done');
    expect(r.bonus?.total.xp).toBe(10);
  });

  it('starting a new session clears a pending choice', async () => {
    const { steps } = await seed();
    const a = await startSession({ stepId: steps[0]!.id });
    await endSession(a.session.id, 'timer_done', { at: T0, awaitChoice: true });
    expect(await getAwaiting()).not.toBeNull();
    await startSession({ stepId: steps[0]!.id });
    expect(await db.local_meta.get(AWAITING_KEY)).toBeUndefined();
  });
});

describe('done in a session', () => {
  it('ends the session, completes the step, pays, and can finish the quest', async () => {
    const completed = record('step.completed');
    const questDone = record('quest.completed');
    const { quest, steps } = await seed(2);
    const a = await startSession({ stepId: steps[0]!.id });
    at(T0 + 10 * MIN);
    const r1 = await completeStepInSession(a.session.id);
    expect(r1.end.session.end_reason).toBe('step_done');
    expect(r1.completion?.step.done_at).not.toBeNull();
    expect(r1.completion?.step.actual_ms).toBe(10 * MIN);
    expect(completed[0]).toMatchObject({ sessionId: a.session.id, withoutTimer: false });
    expect(await getOpenSession()).toBeNull();

    const b = await startSession({ stepId: steps[1]!.id });
    at(T0 + 20 * MIN);
    const r2 = await completeStepInSession(b.session.id);
    expect(r2.completion?.questCompletion?.quest.status).toBe('done');
    expect(questDone).toHaveLength(1);

    const rewards = await sessionRewards(b.session);
    expect(rewards.focus).toBe(2);
    expect(rewards.step.xp).toBeGreaterThan(0);
    expect(rewards.quest.xp).toBe(32); // 40% of C (80 XP)
    expect((await db.quests.get(quest.id))?.status).toBe('done');
  });

  it('works after the timer already ended', async () => {
    const { steps } = await seed(2);
    const a = await startSession({ stepId: steps[0]!.id });
    await endSession(a.session.id, 'timer_done', { at: T0 + 25 * MIN, awaitChoice: true });
    at(T0 + 30 * MIN);
    const r = await completeStepInSession(a.session.id);
    expect(r.end.changed).toBe(false);
    expect(r.completion?.step.done_at).not.toBeNull();
    expect(await getAwaiting()).toBeNull();
  });
});

describe('distractions and time away', () => {
  it('parks a note in the Inbox and logs it on the session', async () => {
    const logged = record('distraction.logged');
    const { steps } = await seed();
    const { session } = await startSession({ stepId: steps[0]!.id });
    const r = await logDistraction({ sessionId: session.id, text: '  Email the teacher ' });
    const inbox = await listQuestsByStatus('inbox');
    expect(inbox.map((q) => [q.title, q.source])).toEqual([['Email the teacher', 'distraction']]);
    expect(r.inboxQuestId).toBe(inbox[0]!.id);
    const note = await db.distraction_notes.get(r.noteId!);
    expect(note).toMatchObject({ session_id: session.id, inbox_quest_id: inbox[0]!.id });
    const s = await focusSessionsRepo.get(session.id);
    expect(s?.distractions).toEqual([
      { at: new Date(T0).toISOString(), kind: 'button', note_id: r.noteId },
    ]);
    expect(logged).toEqual([{ sessionId: session.id, noteId: r.noteId }]);
  });

  it('an empty note still logs the distraction, without an Inbox quest', async () => {
    const { steps } = await seed();
    const { session } = await startSession({ stepId: steps[0]!.id });
    const r = await logDistraction({ sessionId: session.id, text: '   ' });
    expect(r).toEqual({ noteId: null, inboxQuestId: null });
    expect(await listQuestsByStatus('inbox')).toEqual([]);
    expect((await focusSessionsRepo.get(session.id))?.distractions).toHaveLength(1);
  });

  it('records time away without touching focused time', async () => {
    const { steps } = await seed();
    const { session } = await startSession({ stepId: steps[0]!.id });
    at(T0 + 2 * MIN);
    await markAway(session.id);
    await markAway(session.id); // one open period only
    at(T0 + 3 * MIN);
    await logSessionEvent(session.id, 'left_app');
    at(T0 + 5 * MIN);
    expect(await markBack(session.id)).toBe(3 * MIN);
    expect(await markBack(session.id)).toBe(0);
    at(T0 + 10 * MIN);
    const r = await endSession(session.id, 'stopped');
    expect(r.session.away_ms).toBe(3 * MIN);
    expect(r.session.focused_ms).toBe(10 * MIN);
    expect(r.session.distractions.map((d) => d.kind)).toEqual(['left_app']);
  });

  it('an away period still open at the end is closed at the end', async () => {
    const { steps } = await seed();
    const { session } = await startSession({ stepId: steps[0]!.id });
    at(T0 + 20 * MIN);
    await markAway(session.id);
    at(T0 + 90 * MIN);
    const r = await endSession(session.id, 'ended_while_away', { at: T0 + 25 * MIN });
    expect(r.session.away).toEqual([
      {
        start: new Date(T0 + 20 * MIN).toISOString(),
        end: new Date(T0 + 25 * MIN).toISOString(),
      },
    ]);
    expect(r.session.away_ms).toBe(5 * MIN);
    expect(r.session.focused_ms).toBe(25 * MIN);
  });

  it('breaks do not track time away', async () => {
    const { steps } = await seed();
    const { session } = await startSession({ stepId: steps[0]!.id, kind: 'break' });
    expect(await markAway(session.id)).toBeNull();
  });
});

describe('a double-XP potion waiting for the next session', () => {
  async function drinkPotion() {
    return powerUpActivationsRepo.create({
      type: 'double_xp_potion',
      inventory_item_id: 'potion-unit',
      activated_at: new Date(T0).toISOString(),
      target_type: 'focus_session',
      target_id: null,
    });
  }

  it('doubles the next focus session from its start, exactly once', async () => {
    const { steps } = await seed(2);
    const potion = await drinkPotion();
    const a = await startSession({ stepId: steps[0]!.id });
    expect(a.session.double_xp).toBe(true);
    expect((await powerUpActivationsRepo.get(potion.id))?.target_id).toBe(a.session.id);

    // Done right away: the step reward is already doubled (C: 48 XP pool / 2 steps = 24, x2).
    const r = await completeStepInSession(a.session.id);
    expect(r.completion?.grant?.total.xp).toBe(48);
    const stepEvent = (await db.ledger_events.toArray()).find((e) => e.kind === 'step_reward');
    expect(stepEvent?.meta).toEqual({ double_xp: true });

    // The potion is used up: the next session is normal, and nothing is pending any more.
    const b = await startSession({ stepId: steps[1]!.id });
    expect(b.session.double_xp).toBe(false);
    const pending = await powerUpActivationsRepo.list((x) => x.target_id === null);
    expect(pending).toEqual([]);
    const c = await completeStepInSession(b.session.id);
    expect(c.completion?.grant?.total.xp).toBeLessThan(48);
  });

  it('a break does not use the potion up', async () => {
    const { steps } = await seed();
    const potion = await drinkPotion();
    const br = await startSession({ stepId: steps[0]!.id, kind: 'break' });
    expect(br.session.double_xp).toBe(false);
    expect((await powerUpActivationsRepo.get(potion.id))?.target_id).toBeNull();
  });
});
