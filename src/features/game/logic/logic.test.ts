import { beforeEach, describe, expect, it } from 'vitest';
import { resetAll } from '@/test/db';
import {
  clock,
  createQuest,
  db,
  energyCheckinsRepo,
  ensureLocalData,
  focusSessionsRepo,
  getProfile,
  ledgerTotals,
  setClock,
  setCurrentUserId,
  UUID_RE,
} from '@/data';
import { sequenceRng } from '@/domain/rng';
import { completeStep, events, grantReward, InsufficientGoldError } from '@/services';
import { checkAchievements, hasComeback, isAccurate } from './achievements';
import {
  dayActivity,
  ensureDailyQuests,
  evaluateDailyQuests,
  rerollDaily,
  stableUuid,
} from './dailyQuests';
import { equipAvatar, placeCottageItem, resolveRoom } from './looks';
import {
  activateLuckyCharm,
  applyPendingPotion,
  drinkDoubleXpPotion,
  luckyCharmActiveUntil,
  NoPowerUpError,
  unusedPowerUps,
} from './powerUps';
import {
  AlreadyOwnedError,
  buyCosmetic,
  buyPowerUp,
  buyUserReward,
  createUserReward,
  deleteUserReward,
  ItemLockedError,
  ownedCosmeticIds,
  redeemUserReward,
} from './shop';
import { DAILY_QUEST_POOL } from '@/domain/dailyQuests';

const T0 = Date.parse('2026-03-10T10:00:00.000Z');
const noLoot = () => sequenceRng([0.99]);

async function giveGold(gold: number, xp = 0) {
  await grantReward({
    kind: 'fixed',
    ledgerKind: 'adjustment',
    sourceType: 'system',
    sourceId: 'test',
    dedupeKey: `test:${Math.random()}`,
    reward: { xp, gold },
  });
}

async function finishQuickStep(opts: { difficulty?: 'E' | 'S'; boss?: boolean } = {}) {
  const { steps } = await createQuest({
    title: 'q',
    difficulty: opts.difficulty ?? 'E',
    is_boss: opts.boss ?? false,
    steps: [{ title: 's', guess_minutes: 2, quick: true }],
  });
  await completeStep(steps[0]!.id, { rng: noLoot() });
  return steps[0]!;
}

beforeEach(async () => {
  await resetAll();
  setClock(T0);
  await ensureLocalData();
});

describe('shop purchases', () => {
  it('buys a cosmetic with gold and adds it to the inventory', async () => {
    await giveGold(100);
    await buyCosmetic('hat_beanie');
    expect((await ledgerTotals()).gold).toBe(50);
    expect((await ownedCosmeticIds()).has('hat_beanie')).toBe(true);
    await expect(buyCosmetic('hat_beanie')).rejects.toBeInstanceOf(AlreadyOwnedError);
  });

  it('never goes below zero and keeps the inventory unchanged', async () => {
    await giveGold(10);
    await expect(buyCosmetic('hat_beanie')).rejects.toBeInstanceOf(InsufficientGoldError);
    expect((await ledgerTotals()).gold).toBe(10);
    expect(await db.inventory.count()).toBe(0);
  });

  it('refuses items above the player level', async () => {
    await giveGold(1000);
    await expect(buyCosmetic('hat_wizard')).rejects.toEqual(new ItemLockedError(15));
    expect((await ledgerTotals()).gold).toBe(1000);
  });

  it('starter items are owned without buying', async () => {
    const owned = await ownedCosmeticIds();
    expect(owned.has('hair_short')).toBe(true);
    expect(owned.has('rug_round')).toBe(true);
  });

  it('creates, buys, redeems and deletes a real-life reward', async () => {
    const reward = await createUserReward({ title: ' Movie night ', price_gold: 30, icon: '🎬' });
    expect(reward.title).toBe('Movie night');
    await expect(buyUserReward(reward.id)).rejects.toBeInstanceOf(InsufficientGoldError);
    await giveGold(40);
    const item = await buyUserReward(reward.id);
    expect((await ledgerTotals()).gold).toBe(10);
    const redeemed = await redeemUserReward(item.id);
    expect(redeemed.used_at).not.toBeNull();
    await deleteUserReward(reward.id);
    expect(await db.inventory.get(item.id)).toBeDefined();
  });

  it('rejects an empty title or a bad price', async () => {
    await expect(createUserReward({ title: ' ', price_gold: 5, icon: '' })).rejects.toThrow();
    await expect(createUserReward({ title: 'x', price_gold: 0, icon: '' })).rejects.toThrow();
  });
});

describe('equipping', () => {
  it('equips owned items only and resolves the starter room', async () => {
    await expect(equipAvatar('hat', 'hat_beanie')).rejects.toThrow();
    await giveGold(60);
    await buyCosmetic('hat_beanie');
    await equipAvatar('hat', 'hat_beanie');
    expect((await getProfile()).avatar.hat).toBe('hat_beanie');
    const room = resolveRoom((await getProfile()).cottage);
    expect(room.slots.rug).toBe('rug_round');
    await placeCottageItem('rug', null);
    expect(resolveRoom((await getProfile()).cottage).slots.rug).toBeNull();
  });
});

describe('power-ups', () => {
  it('lucky charm activates for 24 hours and doubles loot chances', async () => {
    await expect(activateLuckyCharm()).rejects.toBeInstanceOf(NoPowerUpError);
    await giveGold(100);
    await buyPowerUp('lucky_charm');
    const used: string[] = [];
    events.on('power_up.used', (p) => used.push(p.type));
    await activateLuckyCharm();
    expect(used).toEqual(['lucky_charm']);
    expect(await luckyCharmActiveUntil()).toBe(T0 + 24 * 3600_000);
    expect(await luckyCharmActiveUntil(T0 + 25 * 3600_000)).toBeNull();
    expect(await unusedPowerUps('lucky_charm')).toHaveLength(0);
  });

  it('double-XP potion waits for the next focus session', async () => {
    await giveGold(100);
    await buyPowerUp('double_xp_potion');
    expect(await drinkDoubleXpPotion()).toEqual({ appliedNow: false });
    const session = await focusSessionsRepo.create({
      kind: 'focus',
      quest_id: null,
      step_id: null,
      started_at: clock.iso(),
      planned_ms: 1500_000,
      pauses: [],
      away: [],
      distractions: [],
      ended_at: null,
      end_reason: null,
      focused_ms: 0,
      away_ms: 0,
      paused_ms: 0,
      double_xp: false,
      device_id: 'd',
    });
    expect(await applyPendingPotion(session.id)).toBe(true);
    expect((await focusSessionsRepo.get(session.id))!.double_xp).toBe(true);
    expect(await applyPendingPotion(session.id)).toBe(false);
  });

  it('reroll swaps one daily quest and uses the power-up', async () => {
    const [first] = await ensureDailyQuests(clock.today());
    await expect(rerollDaily(first!.id)).rejects.toBeInstanceOf(NoPowerUpError);
    await giveGold(100);
    await buyPowerUp('daily_reroll');
    const next = await rerollDaily(first!.id, sequenceRng([0.3, 0.6, 0.1]));
    expect(next.quest_key).not.toBe(first!.quest_key);
    expect(next.rerolled).toBe(true);
    expect(await unusedPowerUps('daily_reroll')).toHaveLength(0);
  });
});

describe('daily quests', () => {
  it('creates three goals once per day, the same on every call', async () => {
    const a = await ensureDailyQuests('2026-03-10');
    const b = await ensureDailyQuests('2026-03-10');
    expect(a).toHaveLength(3);
    expect(b.map((r) => r.id)).toEqual(a.map((r) => r.id));
  });

  it('counts activity and pays a finished goal exactly once', async () => {
    const day = clock.today();
    const rows = await ensureDailyQuests(day);
    const steps1 = DAILY_QUEST_POOL.find((d) => d.key === 'steps_1')!;
    await db.daily_quests.update(rows[0]!.id, {
      quest_key: 'steps_1',
      kind: steps1.kind,
      target: 1,
      reward_gold: 5,
    });
    expect((await evaluateDailyQuests(day)).length).toBe(0);
    await finishQuickStep();
    await energyCheckinsRepo.create({ level: 'high', at: clock.iso(), day });
    const activity = await dayActivity(day);
    expect(activity.stepsFinished).toBe(1);
    expect(activity.quickStepsFinished).toBe(1);
    expect(activity.questsFinished).toBe(1);
    expect(activity.energyCheckins).toBe(1);
    const seen: string[] = [];
    events.on('daily_quest.completed', (p) => seen.push(p.dailyQuestId));
    const paid = await evaluateDailyQuests(day);
    expect(paid.map((r) => r.id)).toContain(rows[0]!.id);
    expect(seen).toContain(rows[0]!.id);
    expect(await evaluateDailyQuests(day)).toHaveLength(0);
    expect((await db.daily_quests.get(rows[0]!.id))!.rewarded_at).not.toBeNull();
  });
});

describe('achievements', () => {
  it('pure helpers', () => {
    expect(hasComeback(['2026-03-01', '2026-03-02'])).toBe(false);
    expect(hasComeback(['2026-03-01', '2026-03-03'])).toBe(false);
    expect(hasComeback(['2026-03-01', '2026-03-04'])).toBe(true);
    expect(isAccurate(30, 30 * 60_000)).toBe(true);
    expect(isAccurate(30, 50 * 60_000)).toBe(false);
    expect(isAccurate(null, 10)).toBe(false);
  });

  it('unlocks first step and first quest with gold, once', async () => {
    const seen: string[] = [];
    events.on('achievement.unlocked', (p) => seen.push(p.achievementId));
    await finishQuickStep({ difficulty: 'S', boss: true });
    const first = await checkAchievements();
    expect(first).toEqual(
      expect.arrayContaining(['first_step', 'first_quest', 'first_s_rank', 'boss_defeated']),
    );
    expect(seen).toEqual(first);
    expect(await checkAchievements()).toEqual([]);
    const gold = (await db.ledger_events.where('kind').equals('achievement').toArray()).reduce(
      (s, e) => s + e.gold,
      0,
    );
    expect(gold).toBe(10 + 15 + 50 + 40);
  });
});

describe('daily quest ids are the same on every device', () => {
  it('two independent generations for the same day produce identical rows', async () => {
    const userId = '0d3c6a51-3f0e-4a8c-9a8e-2b1f7c9d4e10';
    const generate = async () => {
      await resetAll();
      setClock(T0);
      setCurrentUserId(userId);
      await ensureLocalData();
      const rows = await ensureDailyQuests('2026-03-10');
      return rows.map((r) => [r.id, r.slot, r.quest_key]);
    };
    const a = await generate();
    const b = await generate();
    expect(a).toHaveLength(3);
    expect(b).toEqual(a);
    for (const [id] of a) expect(UUID_RE.test(id as string)).toBe(true);
    // Idempotent: calling again, even concurrently, never adds rows.
    await Promise.all([ensureDailyQuests('2026-03-10'), ensureDailyQuests('2026-03-10')]);
    expect(await db.daily_quests.count()).toBe(3);
    expect(stableUuid('x')).toBe(stableUuid('x'));
    expect(stableUuid('x')).not.toBe(stableUuid('y'));
  });
});
