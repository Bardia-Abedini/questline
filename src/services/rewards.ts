/**
 * The one way to pay rewards. Every package grants XP and gold through `grantReward`, which
 * asks the domain engine what to pay, appends ledger events (idempotently), pays level-up
 * gifts, rolls loot with an injectable Rng, and emits events after the transaction commits.
 *
 * Nothing else writes reward rows to `ledger_events`. Spending goes through `spendGold`.
 */
import { clock } from '@/data/clock';
import { db } from '@/data/db';
import { newId } from '@/data/ids';
import {
  appendLedgerEvent,
  getSingleton,
  ledgerForQuest,
  ledgerTotals,
  listSteps,
  sumLedger,
  type NewLedgerEvent,
} from '@/data/repositories';
import { recordChange, stampNewRow } from '@/data/repositories/base';
import type { InventoryItem, LedgerEvent, LedgerKind, LedgerSourceType, Uuid } from '@/data/types';
import { levelFromXp, levelsGained, levelUpGold, isMilestoneLevel } from '@/domain/levels';
import { anyLuckyCharmActive, rollQuestLoot, rollStepLoot } from '@/domain/loot';
import { finishBonus, bossExtra, focusBonusXp, multiplyXp, stepPayout } from '@/domain/rewards';
import { createRng, type Rng } from '@/domain/rng';
import { computeStreak } from '@/domain/streak';
import { addRewards, type Reward } from '@/domain/types';
import { events } from './events';

/** Tables a reward grant may touch. Include them in any outer `writeTransaction`. */
export const REWARD_TABLES = [
  'ledger_events',
  'quests',
  'steps',
  'focus_sessions',
  'daily_quests',
  'inventory',
  'streak_state',
  'power_up_activations',
] as const;

export type RewardRequest =
  /** A step was checked off. Pays its share of the 60% step pool and may drop bonus gold. */
  | { kind: 'step'; stepId: Uuid; sessionId?: Uuid | null }
  /** A quest was finished. Pays the 40% finish bonus (+25% for bosses) and may drop a rare item. */
  | { kind: 'quest_finish'; questId: Uuid }
  /** A timed focus session ended. +1 XP per 5 focused minutes (x2 with a double-XP potion). */
  | { kind: 'focus_bonus'; sessionId: Uuid }
  /** A daily quest was completed. Pays its gold. */
  | { kind: 'daily_quest'; dailyQuestId: Uuid }
  /** Anything else with a fixed amount (achievements, Game extras). `dedupeKey` must be unique. */
  | {
      kind: 'fixed';
      ledgerKind: Extract<LedgerKind, 'achievement' | 'adjustment' | 'refund'>;
      sourceType: LedgerSourceType;
      sourceId: string;
      dedupeKey: string;
      reward: Reward;
      meta?: Record<string, unknown>;
    };

export interface GrantResult {
  request: RewardRequest;
  /** XP and gold paid by this call, level-up gifts and loot included. */
  total: Reward;
  /** Ledger events written by this call (empty if everything was already granted). */
  events: LedgerEvent[];
  /** True when the main reward had already been granted before (nothing new paid for it). */
  alreadyGranted: boolean;
  levelUps: Array<{ level: number; goldGift: number; milestone: boolean }>;
  loot: { bonusGold: number; rareItemId: string | null };
  /** Total XP before and after, for XP bar animations. */
  xpBefore: number;
  xpAfter: number;
}

export interface GrantOptions {
  /** Randomness for loot. Defaults to a fresh random seed. Pass a seeded Rng in tests. */
  rng?: Rng;
}

export interface RewardConfig {
  /** Rare cosmetics that can drop on a quest finish (Game's catalog). */
  rareItemIds: () => readonly string[];
}

let config: RewardConfig = { rareItemIds: () => [] };

/** Game calls this once at startup to plug in its catalog. */
export function configureRewards(next: Partial<RewardConfig>): void {
  config = { ...config, ...next };
}

function defaultRng(): Rng {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return createRng(buf[0]!);
}

const TABLE_HANDLES = () => [
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

class RewardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RewardError';
  }
}

/**
 * Grants a reward. Idempotent: asking twice for the same step, quest, session or daily quest
 * pays once. Runs in its own transaction, or joins the caller's if it covers REWARD_TABLES
 * and the outbox.
 */
export function grantReward(
  request: RewardRequest,
  options: GrantOptions = {},
): Promise<GrantResult> {
  return db.transaction('rw', TABLE_HANDLES(), async () => {
    const rng = options.rng ?? defaultRng();
    const before = await ledgerTotals();
    const written: LedgerEvent[] = [];
    const loot = { bonusGold: 0, rareItemId: null as string | null };
    let alreadyGranted = false;

    const append = async (e: NewLedgerEvent) => {
      const { event, created } = await appendLedgerEvent(e);
      if (created) written.push(event);
      return created;
    };

    switch (request.kind) {
      case 'step': {
        const step = await db.steps.get(request.stepId);
        if (!step) throw new RewardError(`Unknown step ${request.stepId}`);
        const quest = await db.quests.get(step.quest_id);
        if (!quest) throw new RewardError(`Unknown quest ${step.quest_id}`);
        const steps = await listSteps(quest.id);
        const paidEvents = await ledgerForQuest(quest.id, ['step_reward']);
        const paidStepIds = new Set(paidEvents.map((e) => e.source_id));
        if (paidStepIds.has(step.id)) {
          alreadyGranted = true;
          break;
        }
        const remaining = steps.filter((s) => !paidStepIds.has(s.id)).length || 1;
        let reward = stepPayout({
          difficulty: quest.difficulty,
          totalSteps: Math.max(steps.length, 1),
          remainingSteps: remaining,
          paidSoFar: sumLedger(paidEvents),
        });
        const session = request.sessionId
          ? await db.focus_sessions.get(request.sessionId)
          : undefined;
        if (session?.double_xp) reward = multiplyXp(reward, 2);
        const created = await append({
          kind: 'step_reward',
          xp: reward.xp,
          gold: reward.gold,
          source_type: 'step',
          source_id: step.id,
          quest_id: quest.id,
          dedupe_key: `step:${step.id}`,
          meta: session?.double_xp ? { double_xp: true } : null,
        });
        if (!created) {
          alreadyGranted = true;
          break;
        }
        const luckyCharm = await luckyCharmActive();
        const drop = rollStepLoot(rng, quest.difficulty, { luckyCharm });
        if (drop.bonusGold > 0) {
          await append({
            kind: 'loot_gold',
            xp: 0,
            gold: drop.bonusGold,
            source_type: 'step',
            source_id: step.id,
            quest_id: quest.id,
            dedupe_key: `loot:step:${step.id}`,
            meta: luckyCharm ? { lucky_charm: true } : null,
          });
          loot.bonusGold = drop.bonusGold;
        }
        await updateBestStreak();
        break;
      }

      case 'quest_finish': {
        const quest = await db.quests.get(request.questId);
        if (!quest) throw new RewardError(`Unknown quest ${request.questId}`);
        const finish = finishBonus(quest.difficulty);
        const created = await append({
          kind: 'quest_finish',
          xp: finish.xp,
          gold: finish.gold,
          source_type: 'quest',
          source_id: quest.id,
          quest_id: quest.id,
          dedupe_key: `quest:${quest.id}`,
        });
        if (!created) {
          alreadyGranted = true;
          break;
        }
        if (quest.is_boss) {
          const extra = bossExtra(quest.difficulty);
          await append({
            kind: 'boss_bonus',
            xp: extra.xp,
            gold: extra.gold,
            source_type: 'quest',
            source_id: quest.id,
            quest_id: quest.id,
            dedupe_key: `boss:${quest.id}`,
          });
        }
        const owned = new Set(
          (await db.inventory.where('kind').equals('cosmetic').toArray())
            .filter((i) => i.deleted_at === null)
            .map((i) => i.ref_id),
        );
        const { rareItemId } = rollQuestLoot(rng, quest.difficulty, config.rareItemIds(), owned);
        if (rareItemId) {
          const item = stampNewRow<InventoryItem>({
            id: newId(),
            kind: 'cosmetic',
            ref_id: rareItemId,
            source: 'loot',
            acquired_at: clock.iso(),
            ledger_event_id: null,
            used_at: null,
          });
          await db.inventory.add(item);
          await recordChange('inventory', item.id, 'upsert');
          loot.rareItemId = rareItemId;
        }
        break;
      }

      case 'focus_bonus': {
        const session = await db.focus_sessions.get(request.sessionId);
        if (!session) throw new RewardError(`Unknown session ${request.sessionId}`);
        if (session.kind !== 'focus' || session.ended_at === null) {
          throw new RewardError('Focus bonus needs an ended focus session');
        }
        let xp = focusBonusXp(session.focused_ms);
        if (session.double_xp) xp *= 2;
        if (xp <= 0) break;
        const created = await append({
          kind: 'focus_bonus',
          xp,
          gold: 0,
          source_type: 'focus_session',
          source_id: session.id,
          quest_id: session.quest_id,
          dedupe_key: `focus:${session.id}`,
          meta: { focused_ms: session.focused_ms, double_xp: session.double_xp },
        });
        if (!created) alreadyGranted = true;
        break;
      }

      case 'daily_quest': {
        const dq = await db.daily_quests.get(request.dailyQuestId);
        if (!dq) throw new RewardError(`Unknown daily quest ${request.dailyQuestId}`);
        const created = await append({
          kind: 'daily_quest',
          xp: 0,
          gold: dq.reward_gold,
          source_type: 'daily_quest',
          source_id: dq.id,
          dedupe_key: `daily:${dq.id}`,
        });
        if (!created) {
          alreadyGranted = true;
          break;
        }
        const at = clock.iso();
        await db.daily_quests.put({
          ...dq,
          rewarded_at: at,
          completed_at: dq.completed_at ?? at,
          updated_at: at,
        });
        await recordChange('daily_quests', dq.id, 'upsert');
        break;
      }

      case 'fixed': {
        const created = await append({
          kind: request.ledgerKind,
          xp: request.reward.xp,
          gold: request.reward.gold,
          source_type: request.sourceType,
          source_id: request.sourceId,
          dedupe_key: request.dedupeKey,
          meta: request.meta ?? null,
        });
        if (!created) alreadyGranted = true;
        break;
      }
    }

    // Level-up gifts for every level crossed by this grant. Keyed per level, so never paid twice.
    const xpAfterMain = before.xp + written.reduce((s, e) => s + e.xp, 0);
    const levelUps: GrantResult['levelUps'] = [];
    for (const level of levelsGained(before.xp, xpAfterMain)) {
      const goldGift = levelUpGold(level);
      const created = await append({
        kind: 'level_up_gift',
        xp: 0,
        gold: goldGift,
        source_type: 'level',
        source_id: String(level),
        dedupe_key: `level:${level}`,
      });
      if (created) levelUps.push({ level, goldGift, milestone: isMilestoneLevel(level) });
    }

    const total = addRewards(...written.map((e) => ({ xp: e.xp, gold: e.gold })));
    const result: GrantResult = {
      request,
      total,
      events: written,
      alreadyGranted,
      levelUps,
      loot,
      xpBefore: before.xp,
      xpAfter: before.xp + total.xp,
    };

    if (written.length > 0) {
      events.emitAfterCommit('reward.granted', { grant: result });
      if (loot.bonusGold > 0 && request.kind === 'step') {
        events.emitAfterCommit('loot.dropped', {
          kind: 'gold',
          amount: loot.bonusGold,
          stepId: request.stepId,
        });
      }
      if (loot.rareItemId && request.kind === 'quest_finish') {
        events.emitAfterCommit('loot.dropped', {
          kind: 'item',
          itemId: loot.rareItemId,
          questId: request.questId,
        });
      }
      for (const lu of levelUps) events.emitAfterCommit('level.up', lu);
    }
    return result;
  });
}

/** Whether a lucky charm power-up is working right now (activated less than 24 h ago). */
async function luckyCharmActive(): Promise<boolean> {
  const charms = await db.power_up_activations.where('type').equals('lucky_charm').toArray();
  return anyLuckyCharmActive(
    charms.filter((c) => c.deleted_at === null).map((c) => Date.parse(c.activated_at)),
    clock.now(),
  );
}

/** Keeps `streak_state.best` up to date so the best streak survives anything. */
async function updateBestStreak(): Promise<void> {
  const state = await getSingleton('streak_state');
  if (!state) return;
  const days = (await db.ledger_events.where('kind').equals('step_reward').toArray())
    .filter((e) => e.deleted_at === null)
    .map((e) => e.day);
  const streak = computeStreak({ activeDays: days, today: clock.today() });
  if (streak.best > state.best) {
    await db.streak_state.put({ ...state, best: streak.best, updated_at: clock.iso() });
    await recordChange('streak_state', state.id, 'upsert');
  }
}

export class InsufficientGoldError extends Error {
  constructor(
    public readonly needed: number,
    public readonly available: number,
  ) {
    super(`Not enough gold: need ${needed}, have ${available}`);
    this.name = 'InsufficientGoldError';
  }
}

/**
 * Spends gold (shop purchases). Fails with InsufficientGoldError instead of going negative.
 * Idempotent on `dedupeKey` (use the purchase/inventory id).
 */
export function spendGold(input: {
  amount: number;
  sourceType: Extract<LedgerSourceType, 'shop_item' | 'user_reward'>;
  sourceId: string;
  dedupeKey: string;
  meta?: Record<string, unknown>;
}): Promise<LedgerEvent> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return Promise.reject(new RangeError('amount must be a positive number'));
  }
  return db.transaction('rw', db.ledger_events, db.outbox, async () => {
    const { gold } = await ledgerTotals();
    const existing = await db.ledger_events.where('dedupe_key').equals(input.dedupeKey).first();
    if (existing) return existing;
    if (gold < input.amount) throw new InsufficientGoldError(input.amount, gold);
    const { event } = await appendLedgerEvent({
      kind: 'purchase',
      xp: 0,
      gold: -input.amount,
      source_type: input.sourceType,
      source_id: input.sourceId,
      dedupe_key: input.dedupeKey,
      meta: input.meta ?? null,
    });
    events.emitAfterCommit('gold.spent', {
      amount: input.amount,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
    });
    return event;
  });
}

/** Current level info, derived from the ledger. */
export async function currentLevel() {
  return levelFromXp((await ledgerTotals()).xp);
}
