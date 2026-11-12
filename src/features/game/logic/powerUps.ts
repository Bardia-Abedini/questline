/**
 * Power-up use. Each activation marks one inventory unit used, writes a
 * `power_up_activations` row and emits `power_up.used`.
 *
 * - Lucky charm: the activation row is all; grantReward doubles the step loot chance for 24 h.
 * - Double-XP potion: doubles XP for the open focus session, or, with none open, for the
 *   next one (Game sets `double_xp` on it when `session.started` arrives).
 * - Daily reroll: swaps one of today's daily quests (see dailyQuests.ts).
 */
import {
  clock,
  db,
  focusSessionsRepo,
  inventoryRepo,
  powerUpActivationsRepo,
  writeTransaction,
  type InventoryItem,
  type PowerUpActivation,
  type PowerUpType,
  type Uuid,
} from '@/data';
import { anyLuckyCharmActive, luckyCharmEndsAt } from '@/domain/loot';
import { events } from '@/services';

const alive = <T extends { deleted_at: string | null }>(rows: T[]) =>
  rows.filter((r) => r.deleted_at === null);

export class NoPowerUpError extends Error {
  constructor(type: PowerUpType) {
    super(`No ${type} left`);
    this.name = 'NoPowerUpError';
  }
}

/** Unused units of a power-up, oldest first. */
export async function unusedPowerUps(type: PowerUpType): Promise<InventoryItem[]> {
  const rows = alive(await db.inventory.where('ref_id').equals(type).toArray());
  return rows
    .filter((r) => r.kind === 'power_up' && r.used_at === null)
    .sort((a, b) => (a.acquired_at < b.acquired_at ? -1 : 1));
}

async function activations(type: PowerUpType): Promise<PowerUpActivation[]> {
  return alive(await db.power_up_activations.where('type').equals(type).toArray());
}

/** When the newest working lucky charm stops, or null when none is working. */
export async function luckyCharmActiveUntil(now = clock.now()): Promise<number | null> {
  const ends = (await activations('lucky_charm'))
    .map((a) => Date.parse(a.activated_at))
    .filter((at) => anyLuckyCharmActive([at], now))
    .map(luckyCharmEndsAt);
  return ends.length ? Math.max(...ends) : null;
}

/** A potion waiting for the next focus session (target not set yet). */
export async function pendingPotion(): Promise<PowerUpActivation | undefined> {
  return (await activations('double_xp_potion')).find(
    (a) => a.target_type === 'focus_session' && a.target_id === null,
  );
}

async function openFocusSessionId(): Promise<Uuid | null> {
  const open = alive(await db.focus_sessions.toArray()).filter(
    (s) => s.ended_at === null && s.kind === 'focus',
  );
  open.sort((a, b) => (a.started_at < b.started_at ? 1 : -1));
  return open[0]?.id ?? null;
}

const TABLES = ['inventory', 'power_up_activations', 'focus_sessions', 'daily_quests'] as const;

/**
 * Uses one unit: marks it used and writes the activation. `target` is the daily quest for a
 * reroll; for a potion it is filled in here (open session) or later (next session).
 */
export async function usePowerUp(
  type: PowerUpType,
  target: { type: PowerUpActivation['target_type']; id: string | null } = { type: null, id: null },
  inner?: () => Promise<void>,
): Promise<PowerUpActivation> {
  return writeTransaction(TABLES, async () => {
    const [unit] = await unusedPowerUps(type);
    if (!unit) throw new NoPowerUpError(type);
    const at = clock.iso();
    await inventoryRepo.update(unit.id, { used_at: at });
    const row = await powerUpActivationsRepo.create({
      type,
      inventory_item_id: unit.id,
      activated_at: at,
      target_type: target.type,
      target_id: target.id,
    });
    if (inner) await inner();
    events.emitAfterCommit('power_up.used', { type, inventoryItemId: unit.id });
    return row;
  });
}

export async function activateLuckyCharm(): Promise<PowerUpActivation> {
  if ((await luckyCharmActiveUntil()) !== null) throw new RangeError('A charm is already working');
  return usePowerUp('lucky_charm');
}

/** Drinks a potion: doubles the open focus session now, or the next one. */
export async function drinkDoubleXpPotion(): Promise<{ appliedNow: boolean }> {
  if (await pendingPotion()) throw new RangeError('A potion is already waiting');
  const sessionId = await openFocusSessionId();
  if (sessionId) {
    const session = await focusSessionsRepo.get(sessionId);
    if (session?.double_xp) throw new RangeError('This session is already doubled');
  }
  await usePowerUp('double_xp_potion', { type: 'focus_session', id: sessionId }, async () => {
    if (sessionId) await focusSessionsRepo.update(sessionId, { double_xp: true });
  });
  return { appliedNow: sessionId !== null };
}

/** Called on `session.started`: a waiting potion now doubles this session. */
export async function applyPendingPotion(sessionId: Uuid): Promise<boolean> {
  return writeTransaction(['power_up_activations', 'focus_sessions'], async () => {
    const pending = await pendingPotion();
    const session = await focusSessionsRepo.get(sessionId);
    if (!pending || !session || session.kind !== 'focus' || session.ended_at) return false;
    await powerUpActivationsRepo.update(pending.id, { target_id: sessionId });
    await focusSessionsRepo.update(sessionId, { double_xp: true });
    return true;
  });
}
