import Dexie, { type Table, type Transaction } from 'dexie';
import { db } from './db';
import type { SyncTableName } from './types';

type TableArg = SyncTableName | 'local_meta';

/**
 * Runs `fn` in one read-write transaction over `tables` plus the outbox, so data changes
 * and their outbox entries commit or fail together. Repository calls made inside join it.
 *
 * Use it whenever one user action changes several rows, e.g. completing a step and paying
 * its reward:
 *
 *   await writeTransaction(['steps', 'quests', ...REWARD_TABLES], async () => {
 *     await stepsRepo.update(stepId, { done_at: clock.iso() });
 *     await grantReward({ kind: 'step', stepId });
 *   });
 */
export function writeTransaction<T>(tables: readonly TableArg[], fn: () => Promise<T>): Promise<T> {
  const names = [...new Set<string>([...tables, 'outbox'])];
  const handles: Table[] = names.map((n) => db.table(n));
  return db.transaction('rw', handles, fn);
}

/**
 * Calls `fn` after the current transaction (the outermost one, when nested) commits,
 * or right away when there is no transaction. Use it to emit events only for changes that
 * actually reached the database.
 */
export function afterCommit(fn: () => void): void {
  let tx = Dexie.currentTransaction;
  if (!tx) {
    fn();
    return;
  }
  while (tx.parent) tx = tx.parent;
  let queue = pending.get(tx);
  if (!queue) {
    const q: Array<() => void> = [];
    pending.set(tx, q);
    // One subscriber per transaction, so callbacks run in the order they were registered.
    tx.on('complete', () => {
      for (const cb of q) cb();
    });
    queue = q;
  }
  queue.push(fn);
}

const pending = new WeakMap<Transaction, Array<() => void>>();
