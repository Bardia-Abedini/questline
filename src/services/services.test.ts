import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetAll } from '@/test/db';
import { setClock } from '@/data/clock';
import { db } from '@/data/db';
import { ensureLocalData } from '@/data/bootstrap';
import {
  createQuest,
  focusSessionsRepo,
  dailyQuestsRepo,
  ledgerTotals,
  listSteps,
} from '@/data/repositories';
import { writeTransaction } from '@/data/transaction';
import { sequenceRng } from '@/domain/rng';
import { BASE_REWARDS } from '@/domain/rewards';
import { events, type AppEvents } from './events';
import { completeQuest, completeStep, reopenStep } from './progress';
import {
  configureRewards,
  grantReward,
  InsufficientGoldError,
  REWARD_TABLES,
  spendGold,
} from './rewards';

const T0 = Date.parse('2026-03-10T09:00:00.000Z');
/** An Rng that never drops loot (0.99 > every drop chance). */
const noLoot = () => sequenceRng([0.99]);

beforeEach(async () => {
  await resetAll();
  setClock(T0);
  await ensureLocalData();
  configureRewards({ rareItemIds: () => [] });
});

function record<K extends keyof AppEvents>(name: K) {
  const seen: AppEvents[K][] = [];
  events.on(name, (p) => seen.push(p));
  return seen;
}

describe('event bus', () => {
  it('delivers to listeners, supports once and unsubscribe', () => {
    const a = vi.fn();
    const b = vi.fn();
    const off = events.on('quest.activated', a);
    events.once('quest.activated', b);
    events.emit('quest.activated', { questId: '1' });
    events.emit('quest.activated', { questId: '2' });
    off();
    events.emit('quest.activated', { questId: '3' });
    expect(a).toHaveBeenCalledTimes(2);
    expect(b).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledWith({ questId: '1' });
  });

  it('isolates a failing listener', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const good = vi.fn();
    events.on('quest.archived', () => {
      throw new Error('bad');
    });
    events.on('quest.archived', good);
    events.emit('quest.archived', { questId: 'x' });
    expect(good).toHaveBeenCalled();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('emitAfterCommit waits for the outer transaction and drops events on rollback', async () => {
    const seen = record('quest.archived');
    await writeTransaction(['quests'], async () => {
      events.emitAfterCommit('quest.archived', { questId: 'ok' });
      await db.quests.count();
      expect(seen).toEqual([]);
    });
    expect(seen).toEqual([{ questId: 'ok' }]);

    await expect(
      writeTransaction(['quests'], async () => {
        events.emitAfterCommit('quest.archived', { questId: 'rolled-back' });
        throw new Error('nope');
      }),
    ).rejects.toThrow();
    expect(seen).toEqual([{ questId: 'ok' }]);
  });

  it('emitAfterCommit outside a transaction emits immediately', () => {
    const seen = record('quest.archived');
    events.emitAfterCommit('quest.archived', { questId: 'now' });
    expect(seen).toHaveLength(1);
  });
});

describe('completeStep / completeQuest', () => {
  it('pays each step its share and the finish bonus on the last step (60/40)', async () => {
    const { quest } = await createQuest({
      title: 'Essay',
      difficulty: 'E',
      steps: [{ title: 'a' }, { title: 'b' }, { title: 'c' }, { title: 'd' }, { title: 'e' }],
    });
    const steps = await listSteps(quest.id);
    const stepEvents = record('step.completed');
    const questEvents = record('quest.completed');
    const xp: number[] = [];
    for (const s of steps) {
      const r = await completeStep(s.id, { rng: noLoot() });
      xp.push(r.grant!.events.find((e) => e.kind === 'step_reward')!.xp);
    }
    expect(xp).toEqual([2, 2, 2, 2, 4]);
    expect(stepEvents).toHaveLength(5);
    expect(questEvents).toHaveLength(1);
    expect(questEvents[0]!.grant.total).toEqual({ xp: 8, gold: 4 });
    expect(await ledgerTotals()).toEqual(BASE_REWARDS.E);
    expect((await db.quests.get(quest.id))!.status).toBe('done');
  });

  it('never pays a step twice (re-check after reopening)', async () => {
    const { quest, steps } = await createQuest({
      title: 'A',
      difficulty: 'C',
      steps: [{ title: '1' }, { title: '2' }],
    });
    await completeStep(steps[0]!.id, { rng: noLoot() });
    const again = await completeStep(steps[0]!.id, { rng: noLoot() });
    expect(again.changed).toBe(false);
    await reopenStep(steps[0]!.id);
    const third = await completeStep(steps[0]!.id, { rng: noLoot() });
    expect(third.changed).toBe(true);
    expect(third.grant!.alreadyGranted).toBe(true);
    expect(third.grant!.total).toEqual({ xp: 0, gold: 0 });
    expect(await ledgerTotals()).toEqual({ xp: 24, gold: 12 });
    expect((await db.quests.get(quest.id))!.status).toBe('backlog');
  });

  it('reopening a step of a done quest sets the quest back to active, without taking rewards', async () => {
    const { quest, steps } = await createQuest({ title: 'A', difficulty: 'E' });
    await completeStep(steps[0]!.id, { rng: noLoot() });
    expect((await db.quests.get(quest.id))!.status).toBe('done');
    await reopenStep(steps[0]!.id);
    expect((await db.quests.get(quest.id))!.status).toBe('active');
    expect(await ledgerTotals()).toEqual(BASE_REWARDS.E);
    await completeStep(steps[0]!.id, { rng: noLoot() });
    expect(await ledgerTotals()).toEqual(BASE_REWARDS.E);
  });

  it('marks the confirmed no-timer case and touches the quest', async () => {
    const { quest, steps } = await createQuest({
      title: 'A',
      steps: [{ title: '1' }, { title: '2' }],
    });
    setClock(T0 + 60_000);
    const r = await completeStep(steps[0]!.id, { confirmedWithoutTimer: true, rng: noLoot() });
    expect(r.step.completed_without_timer).toBe(true);
    expect((await db.quests.get(quest.id))!.last_touched_at).toBe('2026-03-10T09:01:00.000Z');
  });

  it('can leave the quest open after the last step', async () => {
    const { quest, steps } = await createQuest({ title: 'A' });
    const r = await completeStep(steps[0]!.id, { autoCompleteQuest: false, rng: noLoot() });
    expect(r.questCompletion).toBeNull();
    expect((await db.quests.get(quest.id))!.status).toBe('backlog');
  });

  it('finishing a quest early checks off and pays the open steps', async () => {
    const { quest } = await createQuest({
      title: 'A',
      difficulty: 'D',
      steps: [{ title: '1' }, { title: '2' }, { title: '3' }],
    });
    const r = await completeQuest(quest.id, { rng: noLoot() });
    expect(r.stepGrants).toHaveLength(3);
    expect(await ledgerTotals()).toEqual(BASE_REWARDS.D);
    expect((await listSteps(quest.id)).every((s) => s.done_at !== null)).toBe(true);
    const again = await completeQuest(quest.id);
    expect(again.changed).toBe(false);
  });

  it('boss quests get +25% on the finish bonus', async () => {
    const { quest } = await createQuest({ title: 'Dragon', difficulty: 'S', is_boss: true });
    await completeQuest(quest.id, { rng: noLoot() });
    // 330 gold from the quest + 90 from level-up gifts (levels 2, 3, 4).
    expect(await ledgerTotals()).toEqual({ xp: 660, gold: 330 + 90 });
    const kinds = (await db.ledger_events.toArray()).map((e) => e.kind).sort();
    expect(kinds).toContain('boss_bonus');
  });

  it('adapts when steps are added midway, still paying exactly 60%', async () => {
    const { quest, steps } = await createQuest({
      title: 'A',
      difficulty: 'C',
      steps: [{ title: '1' }, { title: '2' }],
    });
    await completeStep(steps[0]!.id, { rng: noLoot() });
    await createQuestStep(quest.id, 'extra 1', 3);
    await createQuestStep(quest.id, 'extra 2', 4);
    for (const s of await listSteps(quest.id))
      if (!s.done_at) await completeStep(s.id, { rng: noLoot() });
    expect(await ledgerTotals()).toEqual(BASE_REWARDS.C);
  });
});

async function createQuestStep(questId: string, title: string, position: number) {
  const { stepsRepo } = await import('@/data/repositories');
  return stepsRepo.create({
    quest_id: questId,
    title,
    position,
    guess_minutes: null,
    quick: false,
    quick_source: 'user',
    done_at: null,
    actual_ms: 0,
    completed_without_timer: false,
    no_timer_warned_at: null,
  });
}

describe('loot', () => {
  it('drops bonus gold on a step with a lucky roll', async () => {
    const { steps } = await createQuest({
      title: 'A',
      difficulty: 'C',
      steps: [{ title: '1' }, { title: '2' }],
    });
    const drops = record('loot.dropped');
    const r = await completeStep(steps[0]!.id, { rng: sequenceRng([0.01, 0]) });
    expect(r.grant!.loot.bonusGold).toBe(3);
    expect(drops).toEqual([{ kind: 'gold', amount: 3, stepId: steps[0]!.id }]);
    expect((await ledgerTotals()).gold).toBe(12 + 3);
  });

  it('drops a rare cosmetic on a quest finish into the inventory', async () => {
    configureRewards({ rareItemIds: () => ['hat_star'] });
    const { quest } = await createQuest({ title: 'A', difficulty: 'S' });
    // Step roll: no loot (0.99). Quest roll: drop (0.01), pick index 0.
    const r = await completeQuest(quest.id, { rng: sequenceRng([0.99, 0.01, 0]) });
    expect(r.grant!.loot.rareItemId).toBe('hat_star');
    const inv = await db.inventory.toArray();
    expect(inv).toMatchObject([{ kind: 'cosmetic', ref_id: 'hat_star', source: 'loot' }]);
  });
});

describe('level-ups', () => {
  it('pays the gold gift once per level and emits level.up', async () => {
    const levels = record('level.up');
    const { quest } = await createQuest({ title: 'Big', difficulty: 'S' });
    const r = await completeQuest(quest.id, { rng: noLoot() });
    // 600 XP -> level 4 (needs 450), so levels 2, 3, 4.
    expect(levels.map((l) => l.level)).toEqual([2, 3, 4]);
    expect(levels.map((l) => l.goldGift)).toEqual([20, 30, 40]);
    const gifts = (await db.ledger_events.where('kind').equals('level_up_gift').toArray()).map(
      (e) => e.dedupe_key,
    );
    expect(gifts.sort()).toEqual(['level:2', 'level:3', 'level:4']);
    expect(r.stepGrants[0]!.xpBefore).toBe(0);
    expect(await ledgerTotals()).toEqual({ xp: 600, gold: 300 + 90 });
  });
});

describe('focus bonus', () => {
  async function session(over: Partial<Parameters<typeof focusSessionsRepo.create>[0]> = {}) {
    return focusSessionsRepo.create({
      kind: 'focus',
      quest_id: null,
      step_id: null,
      started_at: '2026-03-10T08:00:00.000Z',
      planned_ms: 25 * 60_000,
      pauses: [],
      away: [],
      distractions: [],
      ended_at: '2026-03-10T08:25:00.000Z',
      end_reason: 'timer_done',
      focused_ms: 25 * 60_000,
      away_ms: 0,
      paused_ms: 0,
      double_xp: false,
      device_id: 'dev',
      ...over,
    });
  }

  it('pays +1 XP per 5 focused minutes, once', async () => {
    const s = await session();
    const r = await grantReward({ kind: 'focus_bonus', sessionId: s.id });
    expect(r.total).toEqual({ xp: 5, gold: 0 });
    const again = await grantReward({ kind: 'focus_bonus', sessionId: s.id });
    expect(again.alreadyGranted).toBe(true);
    expect(again.total.xp).toBe(0);
  });

  it('doubles with a potion, and doubles step XP finished in that session', async () => {
    const s = await session({ double_xp: true });
    expect((await grantReward({ kind: 'focus_bonus', sessionId: s.id })).total.xp).toBe(10);
    const { steps } = await createQuest({ title: 'A', difficulty: 'E' });
    const r = await completeStep(steps[0]!.id, {
      sessionId: s.id,
      autoCompleteQuest: false,
      rng: noLoot(),
    });
    expect(r.grant!.total).toEqual({ xp: 24, gold: 6 });
  });

  it('pays nothing under 5 minutes and rejects open or break sessions', async () => {
    const short = await session({ focused_ms: 4 * 60_000 });
    expect((await grantReward({ kind: 'focus_bonus', sessionId: short.id })).events).toEqual([]);
    const open = await session({ ended_at: null });
    await expect(grantReward({ kind: 'focus_bonus', sessionId: open.id })).rejects.toThrow();
    const brk = await session({ kind: 'break' });
    await expect(grantReward({ kind: 'focus_bonus', sessionId: brk.id })).rejects.toThrow();
    await expect(grantReward({ kind: 'focus_bonus', sessionId: 'missing' })).rejects.toThrow();
  });
});

describe('daily quests, fixed rewards and spending', () => {
  it('pays a daily quest once and marks it rewarded', async () => {
    const dq = await dailyQuestsRepo.create({
      day: '2026-03-10',
      slot: 0,
      quest_key: 'steps_3',
      kind: 'finish_steps',
      target: 3,
      reward_gold: 10,
      completed_at: null,
      rewarded_at: null,
      rerolled: false,
    });
    expect((await grantReward({ kind: 'daily_quest', dailyQuestId: dq.id })).total).toEqual({
      xp: 0,
      gold: 10,
    });
    expect((await grantReward({ kind: 'daily_quest', dailyQuestId: dq.id })).alreadyGranted).toBe(
      true,
    );
    expect((await db.daily_quests.get(dq.id))!.rewarded_at).not.toBeNull();
  });

  it('fixed rewards are keyed and can level up', async () => {
    const levels = record('level.up');
    const req = {
      kind: 'fixed' as const,
      ledgerKind: 'achievement' as const,
      sourceType: 'achievement' as const,
      sourceId: 'first_quest',
      dedupeKey: 'achievement:first_quest',
      reward: { xp: 100, gold: 25 },
    };
    expect((await grantReward(req)).levelUps).toEqual([
      { level: 2, goldGift: 20, milestone: false },
    ]);
    expect((await grantReward(req)).alreadyGranted).toBe(true);
    expect(levels).toHaveLength(1);
  });

  it('spends gold, refuses to go negative, and is idempotent', async () => {
    await grantReward({
      kind: 'fixed',
      ledgerKind: 'adjustment',
      sourceType: 'system',
      sourceId: 'x',
      dedupeKey: 'seed',
      reward: { xp: 0, gold: 50 },
    });
    const spent = record('gold.spent');
    await spendGold({ amount: 30, sourceType: 'user_reward', sourceId: 'r1', dedupeKey: 'buy:1' });
    await spendGold({ amount: 30, sourceType: 'user_reward', sourceId: 'r1', dedupeKey: 'buy:1' });
    expect((await ledgerTotals()).gold).toBe(20);
    await expect(
      spendGold({ amount: 30, sourceType: 'user_reward', sourceId: 'r1', dedupeKey: 'buy:2' }),
    ).rejects.toBeInstanceOf(InsufficientGoldError);
    await expect(
      spendGold({ amount: 0, sourceType: 'shop_item', sourceId: 'x', dedupeKey: 'z' }),
    ).rejects.toThrow(RangeError);
    expect(spent).toHaveLength(1);
  });

  it('grants inside a caller transaction and rolls back with it', async () => {
    const seen = record('reward.granted');
    await expect(
      writeTransaction([...REWARD_TABLES], async () => {
        await grantReward({
          kind: 'fixed',
          ledgerKind: 'adjustment',
          sourceType: 'system',
          sourceId: 'x',
          dedupeKey: 'rollback',
          reward: { xp: 10, gold: 10 },
        });
        throw new Error('abort');
      }),
    ).rejects.toThrow('abort');
    expect(await ledgerTotals()).toEqual({ xp: 0, gold: 0 });
    expect(seen).toEqual([]);
  });
});

describe('streak best', () => {
  it('keeps best streak in streak_state', async () => {
    for (const [i, day] of [
      '2026-03-08T09:00:00.000Z',
      '2026-03-09T09:00:00.000Z',
      '2026-03-10T09:00:00.000Z',
    ].entries()) {
      setClock(Date.parse(day));
      const { steps } = await createQuest({ title: `q${i}` });
      await completeStep(steps[0]!.id, { rng: noLoot() });
    }
    expect((await db.streak_state.toArray())[0]!.best).toBe(3);
  });
});
