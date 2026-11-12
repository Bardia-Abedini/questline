/** Device-local bookkeeping for sync: cursors, epoch, data owner, and wiping synced data. */
import { db, SYNC_TABLES } from '../db';
import type { SyncTableName } from '../types';

export const EPOCH_KEY = 'sync.epoch';
/** The account this device's data belongs to (absent = guest data). */
export const OWNER_KEY = 'sync.owner';
export const cursorKey = (table: SyncTableName) => `sync.cursor.${table}`;
/** Set by ensureLocalData once default categories exist (src/data/bootstrap.ts). */
export const SEEDED_KEY = 'seeded_v1';

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.local_meta.get(key))?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.local_meta.put({ key, value });
}

/** Forgets cursors and epoch (the next pull starts from the beginning). */
export async function clearSyncMeta(): Promise<void> {
  const keys = (await db.local_meta.toCollection().primaryKeys()).filter((k) =>
    String(k).startsWith('sync.'),
  );
  await db.local_meta.bulkDelete(keys);
}

/**
 * Removes every synced row and every pending change from this device. Device id and other
 * local settings stay. Callers decide whether to re-seed defaults (`ensureLocalData`).
 */
export async function wipeSyncedData(): Promise<void> {
  await db.transaction(
    'rw',
    [...SYNC_TABLES.map((t) => db.table(t)), db.outbox],
    async () => {
      for (const t of SYNC_TABLES) await db.table(t).clear();
      await db.outbox.clear();
    },
  );
}
