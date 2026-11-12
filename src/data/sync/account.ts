/**
 * Linking this device's data to an account, and leaving it again. OWNER: Cloud.
 *
 * Signing in on a device:
 * - the device already belongs to this account: nothing to do;
 * - the account is empty: the device's data (guest data and defaults) is uploaded;
 * - the device has no real guest data: the account's data replaces the local defaults;
 * - both have data: the player chooses Merge / Keep account data / Keep this device's data
 *   (`resolveAccountChoice`). Nothing is changed until they choose.
 *
 * Signing out wipes the account's data from this device and starts a fresh guest database
 * (appearance and language are kept by the caller). The data stays safe in the account.
 */
import { ensureLocalData, type BootstrapOptions } from '../bootstrap';
import { db, SINGLETON_TABLES, SYNC_TABLES } from '../db';
import { recordChange } from '../repositories/base';
import { setCurrentUserId } from '../session';
import type { Category, SyncRow, Uuid } from '../types';
import type { SyncEngine } from './engine';
import type { SyncRemote } from './remote';
import {
  clearSyncMeta,
  EPOCH_KEY,
  getMeta,
  OWNER_KEY,
  SEEDED_KEY,
  setMeta,
  wipeSyncedData,
} from './local';

export type AccountChoice = 'merge' | 'keep_account' | 'keep_device';

const SINGLETONS = new Set<string>(SINGLETON_TABLES);

const isDefaultCategory = (c: Category) => c.name_key !== null && (c.name ?? '') === '';

/** The account this device's data belongs to, or null for guest data. */
export function getDataOwner(): Promise<Uuid | null> {
  return getMeta<Uuid>(OWNER_KEY).then((v) => v ?? null);
}

/** Whether the device holds real guest data (anything but defaults and one-row tables). */
export async function hasGuestData(): Promise<boolean> {
  for (const table of SYNC_TABLES) {
    if (SINGLETONS.has(table)) continue;
    const rows = (await db.table(table).toArray()) as SyncRow[];
    const live = rows.filter((r) => r.deleted_at === null);
    if (table === 'categories') {
      if ((live as Category[]).some((c) => !isDefaultCategory(c))) return true;
    } else if (live.length > 0) return true;
  }
  return false;
}

/** Gives every local row the account's id and queues all of them for upload. */
export async function claimLocalRows(userId: Uuid): Promise<number> {
  let count = 0;
  await db.transaction('rw', [...SYNC_TABLES.map((t) => db.table(t)), db.outbox], async () => {
    for (const table of SYNC_TABLES) {
      const rows = (await db.table(table).toArray()) as SyncRow[];
      for (const row of rows) {
        if (row.user_id !== userId) await db.table(table).update(row.id, { user_id: userId });
        await recordChange(table, row.id, row.deleted_at ? 'delete' : 'upsert');
        count++;
      }
    }
  });
  return count;
}

export type ConnectResult = 'ready' | 'needs_choice';

/**
 * Called after sign-in, before the engine starts. Returns `needs_choice` when both the
 * device and the account have data; call `resolveAccountChoice` with the player's answer.
 */
export async function connectAccount(
  userId: Uuid,
  remote: SyncRemote,
  engine: SyncEngine,
  bootstrap: BootstrapOptions,
): Promise<ConnectResult> {
  setCurrentUserId(userId);
  const owner = await getDataOwner();
  if (owner === userId) return 'ready';
  if (owner && owner !== userId) {
    // Leftovers of another account (an interrupted sign-out): never upload them here.
    await wipeSyncedData();
    await clearSyncMeta();
    await db.local_meta.delete(OWNER_KEY);
  }
  const deviceHasData = !owner && (await hasGuestData());
  if (!(await remote.hasData())) {
    await engine.checkEpoch();
    await claimLocalRows(userId);
    await setMeta(OWNER_KEY, userId);
    return 'ready';
  }
  if (!deviceHasData) {
    await useAccountData(userId, engine, bootstrap);
    return 'ready';
  }
  return 'needs_choice';
}

async function useAccountData(userId: Uuid, engine: SyncEngine, bootstrap: BootstrapOptions) {
  await wipeSyncedData();
  await clearSyncMeta();
  await engine.checkEpoch();
  await engine.pullTables(SYNC_TABLES);
  // The account already has its categories; only create missing one-row tables.
  await setMeta(SEEDED_KEY, true);
  await ensureLocalData(bootstrap);
  await claimLocalRows(userId);
  await setMeta(OWNER_KEY, userId);
}

export async function resolveAccountChoice(
  choice: AccountChoice,
  userId: Uuid,
  remote: SyncRemote,
  engine: SyncEngine,
  bootstrap: BootstrapOptions,
): Promise<void> {
  setCurrentUserId(userId);
  if (choice === 'keep_account') {
    await useAccountData(userId, engine, bootstrap);
    return;
  }
  if (choice === 'keep_device') {
    const epoch = await remote.resetData();
    await clearSyncMeta();
    await setMeta(EPOCH_KEY, epoch);
    await claimLocalRows(userId);
    await setMeta(OWNER_KEY, userId);
    return;
  }
  // Merge: bring the account's rows in, fold duplicates of per-device defaults, upload the rest.
  await clearSyncMeta();
  await engine.checkEpoch();
  await engine.pullTables(SYNC_TABLES);
  await foldGuestDuplicates(userId);
  await claimLocalRows(userId);
  await setMeta(OWNER_KEY, userId);
}

/** Removes a never-uploaded local row and its pending change. */
async function dropLocal(table: string, id: Uuid) {
  await db.table(table).delete(id);
  const entry = await db.outbox
    .where('[table+row_id]')
    .equals([table, id])
    .first();
  if (entry?.seq !== undefined) await db.outbox.delete(entry.seq);
}

/**
 * Merge rules for things every device creates on its own:
 * - one-row tables (profile, settings, streak, notification prefs): the account's row wins;
 * - untouched default categories: the account's matching category is used, and the device's
 *   quests, templates and recurring series point to it.
 * Ledger rewards and achievements are deduplicated by their keys while pulling.
 */
async function foldGuestDuplicates(userId: Uuid) {
  await db.transaction('rw', [...SYNC_TABLES.map((t) => db.table(t)), db.outbox], async () => {
    for (const table of SINGLETON_TABLES) {
      const rows = (await db.table(table).toArray()) as SyncRow[];
      const live = rows.filter((r) => r.deleted_at === null);
      if (!live.some((r) => r.user_id === userId)) continue;
      for (const r of rows) if (r.user_id !== userId) await dropLocal(table, r.id);
    }

    const categories = (await db.categories.toArray()).filter((c) => c.deleted_at === null);
    const remap = new Map<Uuid, Uuid>();
    for (const guest of categories.filter((c) => c.user_id !== userId && isDefaultCategory(c))) {
      const match = categories.find(
        (c) => c.user_id === userId && isDefaultCategory(c) && c.name_key === guest.name_key,
      );
      if (match) remap.set(guest.id, match.id);
    }
    if (remap.size === 0) return;
    for (const q of await db.quests.toArray()) {
      if (q.category_id && remap.has(q.category_id)) {
        await db.quests.update(q.id, { category_id: remap.get(q.category_id)! });
      }
    }
    for (const t of await db.templates.toArray()) {
      if (t.category_id && remap.has(t.category_id)) {
        await db.templates.update(t.id, { category_id: remap.get(t.category_id)! });
      }
    }
    for (const r of await db.recurrence_rules.toArray()) {
      const cat = r.template.category_id;
      if (cat && remap.has(cat)) {
        await db.recurrence_rules.update(r.id, {
          template: { ...r.template, category_id: remap.get(cat)! },
        });
      }
    }
    for (const id of remap.keys()) await dropLocal('categories', id);
  });
}

/**
 * After sign-out (or account deletion): this device becomes a fresh guest. `bootstrap`
 * carries the language and appearance to keep.
 */
export async function resetToGuest(bootstrap: BootstrapOptions): Promise<void> {
  await wipeSyncedData();
  await clearSyncMeta();
  await db.local_meta.bulkDelete([OWNER_KEY, SEEDED_KEY]);
  setCurrentUserId(null);
  await ensureLocalData(bootstrap);
}

/** Every synced table, as JSON-ready data (soft-deleted rows included, local tables not). */
export async function exportAllData(): Promise<{
  format: 'questline-export';
  version: 1;
  exported_at: string;
  tables: Record<string, unknown[]>;
}> {
  const tables: Record<string, unknown[]> = {};
  for (const t of SYNC_TABLES) tables[t] = await db.table(t).toArray();
  return { format: 'questline-export', version: 1, exported_at: new Date().toISOString(), tables };
}
