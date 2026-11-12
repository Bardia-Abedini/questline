/**
 * Shop operations: buying cosmetics, power-ups and the player's own real-life rewards,
 * redeeming those rewards, and managing the reward list. Every purchase goes through
 * `spendGold` and adds the inventory row in the same transaction.
 */
import {
  clock,
  db,
  inventoryRepo,
  ledgerTotals,
  newId,
  userRewardsRepo,
  writeTransaction,
  type InventoryItem,
  type PowerUpType,
  type UserReward,
} from '@/data';
import { levelFromXp } from '@/domain/levels';
import { spendGold } from '@/services';
import { cosmeticById, STARTER_IDS } from '../catalog/cosmetics';
import { powerUpDef } from '../catalog/powerUps';

export class ItemLockedError extends Error {
  constructor(public readonly level: number) {
    super(`Unlocks at level ${level}`);
    this.name = 'ItemLockedError';
  }
}

export class AlreadyOwnedError extends Error {
  constructor() {
    super('Already owned');
    this.name = 'AlreadyOwnedError';
  }
}

const alive = <T extends { deleted_at: string | null }>(rows: T[]) =>
  rows.filter((r) => r.deleted_at === null);

/** Cosmetic ids the player owns: starter items plus bought, found and gifted ones. */
export async function ownedCosmeticIds(): Promise<Set<string>> {
  const rows = alive(await db.inventory.where('kind').equals('cosmetic').toArray());
  return new Set([...STARTER_IDS, ...rows.map((r) => r.ref_id)]);
}

async function addInventory(
  kind: InventoryItem['kind'],
  refId: string,
  ledgerEventId: string | null,
): Promise<InventoryItem> {
  return inventoryRepo.create({
    kind,
    ref_id: refId,
    source: 'purchase',
    acquired_at: clock.iso(),
    ledger_event_id: ledgerEventId,
    used_at: null,
  });
}

/** Buys a cosmetic. Throws ItemLockedError, AlreadyOwnedError or InsufficientGoldError. */
export async function buyCosmetic(itemId: string): Promise<InventoryItem> {
  const item = cosmeticById(itemId);
  if (!item) throw new RangeError(`Unknown item ${itemId}`);
  return writeTransaction(['ledger_events', 'inventory'], async () => {
    if ((await ownedCosmeticIds()).has(itemId)) throw new AlreadyOwnedError();
    const level = levelFromXp((await ledgerTotals()).xp).level;
    if (level < item.unlockLevel) throw new ItemLockedError(item.unlockLevel);
    const purchase = await spendGold({
      amount: item.price,
      sourceType: 'shop_item',
      sourceId: itemId,
      dedupeKey: `purchase:${newId()}`,
      meta: { kind: 'cosmetic' },
    });
    return addInventory('cosmetic', itemId, purchase.id);
  });
}

/** Buys one power-up. */
export async function buyPowerUp(type: PowerUpType): Promise<InventoryItem> {
  const def = powerUpDef(type);
  return writeTransaction(['ledger_events', 'inventory'], async () => {
    const purchase = await spendGold({
      amount: def.price,
      sourceType: 'shop_item',
      sourceId: type,
      dedupeKey: `purchase:${newId()}`,
      meta: { kind: 'power_up' },
    });
    return addInventory('power_up', type, purchase.id);
  });
}

/* ------------------------------------------------------- real-life rewards */

export interface UserRewardInput {
  title: string;
  notes?: string;
  price_gold: number;
  icon: string;
}

export function validRewardPrice(price: number): boolean {
  return Number.isInteger(price) && price >= 1 && price <= 100_000;
}

export async function createUserReward(input: UserRewardInput): Promise<UserReward> {
  const title = input.title.trim();
  if (!title) throw new RangeError('title is required');
  if (!validRewardPrice(input.price_gold)) throw new RangeError('invalid price');
  return userRewardsRepo.create({
    title,
    notes: input.notes?.trim() ?? '',
    price_gold: input.price_gold,
    icon: input.icon,
    archived_at: null,
  });
}

export async function updateUserReward(id: string, input: UserRewardInput): Promise<UserReward> {
  const title = input.title.trim();
  if (!title) throw new RangeError('title is required');
  if (!validRewardPrice(input.price_gold)) throw new RangeError('invalid price');
  return userRewardsRepo.update(id, {
    title,
    notes: input.notes?.trim() ?? '',
    price_gold: input.price_gold,
    icon: input.icon,
  });
}

/** Removes a reward from the shop. Bought, unredeemed ones stay in the inventory. */
export function deleteUserReward(id: string): Promise<void> {
  return userRewardsRepo.remove(id);
}

export async function buyUserReward(rewardId: string): Promise<InventoryItem> {
  return writeTransaction(['ledger_events', 'inventory', 'user_rewards'], async () => {
    const reward = await userRewardsRepo.get(rewardId);
    if (!reward) throw new RangeError(`Unknown reward ${rewardId}`);
    const purchase = await spendGold({
      amount: reward.price_gold,
      sourceType: 'user_reward',
      sourceId: reward.id,
      dedupeKey: `purchase:${newId()}`,
      meta: { title: reward.title },
    });
    return addInventory('user_reward', reward.id, purchase.id);
  });
}

/** Marks a bought real-life reward as enjoyed. */
export async function redeemUserReward(inventoryId: string): Promise<InventoryItem> {
  const row = await inventoryRepo.get(inventoryId);
  if (!row || row.kind !== 'user_reward') throw new RangeError('Not a reward');
  if (row.used_at) return row;
  return inventoryRepo.update(inventoryId, { used_at: clock.iso() });
}
