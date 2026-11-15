import { beforeEach, describe, expect, it } from 'vitest';
import { resetAll } from '@/test/db';
import {
  clock,
  createQuest,
  db,
  ensureLocalData,
  focusSessionsRepo,
  setClock,
  writeTransaction,
  type FocusSession,
} from '@/data';
import { sequenceRng } from '@/domain/rng';
import { completeStep, events, grantReward } from '@/services';
import { setup } from '../setup';
import {
  applyPendingPotion,
  drinkDoubleXpPotion,
  topUpPotionFocus,
  topUpPotionStep,
} from './powerUps';
import { buyPowerUp } from './shop';

const T0 = Date.parse('2026-03-10T10:00:00.000Z');

async function givePotion() {
  await grantReward({
    kind: 'fixed',
    ledgerKind: 'adjustment',
    sourceType: 'system',
    sourceId: 't',
    dedupeKey: 't:gold',
    reward: { xp: 0, gold: 100 },
  });
  await buyPowerUp('double_xp_potion');
  expect(await drinkDoubleXpPotion()).toEqual({ appliedNow: false });
}

function sessionInput(stepId: string, questId: string) {
  return {
    kind: 'focus' as const,
    quest_id: questId,
    step_id: stepId,
    started_at: clock.iso(),
    planned_ms: 25 * 60_000,
    pauses: [],
    away: [],
    distractions: [],
    ended_at: null,
    end_reason: null,
    focused_ms: 0,
    away_ms: 0,
    paused_ms: 0,
    double_xp: false,
    device_id: 'test',
  };
}

/** Starts a session the way Focus does: create the row, emit `session.started` after commit. */
async function startLikeFocus(stepId: string, questId: string): Promise<FocusSession> {
  return writeTransaction(['focus_sessions'], async () => {
    const s = await focusSessionsRepo.create(sessionInput(stepId, questId));
    events.emitAfterCommit('session.started', {
      sessionId: s.id,
      questId,
      stepId,
      kind: 'focus',
    });
    return s;
  });
}

beforeEach(async () => {
  await resetAll();
  setClock(T0);
  await ensureLocalData();
});

describe('double-XP potion with no gap', () => {
  it('doubles a step finished immediately after the session starts', async () => {
    const off = setup();
    await givePotion();
    const { quest, steps } = await createQuest({
      title: 'q',
      difficulty: 'C',
      steps: [{ title: 'a' }, { title: 'b' }],
    });
    const session = await startLikeFocus(steps[0]!.id, quest.id);
    // No await between start and completion other than the completion itself.
    const result = await completeStep(steps[0]!.id, {
      sessionId: session.id,
      rng: sequenceRng([0.99]),
    });
    const reward = result.grant!.events.find((e) => e.kind === 'step_reward')!;
    expect(reward.meta).toEqual({ double_xp: true });
    expect(reward.xp).toBe(2 * Math.floor(48 / 2));
    expect((await focusSessionsRepo.get(session.id))!.double_xp).toBe(true);
    if (typeof off === 'function') off();
  });
});

describe('double-XP potion safety net', () => {
  it('tops up a step and the focus bonus paid before the flag landed, once', async () => {
    await givePotion();
    const { quest, steps } = await createQuest({
      title: 'q',
      difficulty: 'C',
      steps: [{ title: 'a' }, { title: 'b' }],
    });
    const session = await focusSessionsRepo.create(sessionInput(steps[0]!.id, quest.id));
    const result = await completeStep(steps[0]!.id, {
      sessionId: session.id,
      rng: sequenceRng([0.99]),
    });
    const reward = result.grant!.events.find((e) => e.kind === 'step_reward')!;
    expect(reward.meta).toBeNull();
    // Focus ends the session and pays the bonus before the potion reaches it.
    await focusSessionsRepo.update(session.id, {
      ended_at: clock.iso(),
      end_reason: 'step_done',
      focused_ms: 20 * 60_000,
    });
    await grantReward({ kind: 'focus_bonus', sessionId: session.id });
    expect(await applyPendingPotion(session.id)).toBe(false); // already ended
    // Link the potion to that session as if it had arrived late.
    const potion = (await db.power_up_activations.toArray())[0]!;
    await db.power_up_activations.put({ ...potion, target_id: session.id });

    const input = {
      stepId: steps[0]!.id,
      sessionId: session.id,
      stepRewardXp: reward.xp,
      alreadyDoubled: false,
    };
    expect(await topUpPotionStep(input)).toBe(true);
    expect(await topUpPotionStep(input)).toBe(false);
    expect(await topUpPotionFocus(session.id)).toBe(true);
    expect(await topUpPotionFocus(session.id)).toBe(false);
    const topUps = (await db.ledger_events.toArray()).filter((e) =>
      e.dedupe_key.startsWith('potion:'),
    );
    expect(topUps.map((e) => e.xp).sort()).toEqual([4, reward.xp].sort());
  });
});
