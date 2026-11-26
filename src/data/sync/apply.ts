/**
 * Applies rows from the server to the local database. Remote changes are written straight to
 * the Dexie tables (never through repositories), so they are not queued to the outbox again.
 *
 * Rules:
 * - No pending local change for the row: the server's version is authoritative.
 * - A pending local change that is newer than the server's row: keep it (it will be pushed and
 *   the server applies last-write-wins with clock-skew correction).
 * - A pending local change that is older: the server's row wins and the pending change is
 *   dropped (last write wins).
 * - Ledger rows never change once written.
 * - Natural keys (ledger `dedupe_key`, `achievement_id`): if the device has a different row for
 *   the same key, the server's row replaces it, so a reward or achievement exists once.
 */
import { db } from '../db';
import type { SyncRow, SyncTableName, SyncTables, Uuid } from '../types';
import { APPEND_ONLY_TABLES, NATURAL_KEYS } from './columns';
import { fromRemote, sameRow, type RemoteRow } from './rows';

export interface ApplyResult {
  applied: number;
  skipped: number;
}

export async function applyRemoteRows<N extends SyncTableName>(
  table: N,
  rawRows: readonly RemoteRow[],
): Promise<ApplyResult> {
  type T = SyncTables[N];
  const result: ApplyResult = { applied: 0, skipped: 0 };
  if (rawRows.length === 0) return result;
  const t = db.table<T, Uuid>(table);
  const naturalKey = NATURAL_KEYS[table];
  const appendOnly = APPEND_ONLY_TABLES.includes(table);

  await db.transaction('rw', t, db.outbox, async () => {
    for (const raw of rawRows) {
      const remote = fromRemote(table, raw);
      const local = await t.get(remote.id);
      const pending = await db.outbox.where('[table+row_id]').equals([table, remote.id]).first();

      if (local) {
        if (appendOnly || sameRow(table, local, remote)) {
          // Already have it. A pending entry for an identical row is redundant.
          if (pending?.seq !== undefined && sameRow(table, local, remote)) {
            await db.outbox.delete(pending.seq);
          }
          result.skipped++;
          continue;
        }
        if (pending && (local as SyncRow).updated_at > (remote as SyncRow).updated_at) {
          result.skipped++;
          continue;
        }
      }

      if (naturalKey) {
        const key = (remote as unknown as Record<string, unknown>)[naturalKey];
        const twins = await t
          .where(naturalKey)
          .equals(key as string)
          .filter((r) => r.id !== remote.id)
          .toArray();
        for (const twin of twins) {
          await t.delete(twin.id);
          const twinEntry = await db.outbox
            .where('[table+row_id]')
            .equals([table, twin.id])
            .first();
          if (twinEntry?.seq !== undefined) await db.outbox.delete(twinEntry.seq);
        }
      }

      await t.put(remote);
      if (pending?.seq !== undefined) await db.outbox.delete(pending.seq);
      result.applied++;
    }
  });
  return result;
}
