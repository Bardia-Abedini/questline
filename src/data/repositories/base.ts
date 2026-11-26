import type { Table } from 'dexie';
import { clock } from '../clock';
import { db } from '../db';
import { newId } from '../ids';
import { getCurrentUserId } from '../session';
import type {
  NewRow,
  OutboxOp,
  RowPatch,
  SyncRow,
  SyncTableName,
  SyncTables,
  Uuid,
} from '../types';

/**
 * Records a local change for the sync engine. Must run inside a transaction that includes
 * the outbox (every repository write does this for you). One entry per row: a later change
 * to the same row updates the existing entry instead of adding another.
 *
 * Contract for the sync engine (Cloud package): read entries in `seq` order, push the
 * row's current state, then delete the entry only if its `changed_at` is unchanged
 * (otherwise the row changed again during the push and must be pushed again).
 */
export async function recordChange(table: SyncTableName, rowId: Uuid, op: OutboxOp): Promise<void> {
  const changedAt = clock.iso();
  const existing = await db.outbox.where('[table+row_id]').equals([table, rowId]).first();
  if (existing?.seq !== undefined) {
    await db.outbox.update(existing.seq, {
      op,
      changed_at: changedAt,
      attempts: 0,
      last_error: null,
    });
    return;
  }
  await db.outbox.add({
    table,
    row_id: rowId,
    op,
    changed_at: changedAt,
    attempts: 0,
    last_error: null,
  });
}

export function isAlive<T extends SyncRow>(row: T | undefined): row is T {
  return !!row && row.deleted_at === null;
}

export interface Repository<T extends SyncRow> {
  readonly tableName: SyncTableName;
  /** The Dexie table, for custom queries. Reads must skip rows with `deleted_at` set. */
  readonly table: Table<T, Uuid>;
  /** A live row by id (undefined if missing or soft-deleted). */
  get(id: Uuid): Promise<T | undefined>;
  /** A row by id even if soft-deleted. */
  getAny(id: Uuid): Promise<T | undefined>;
  /** All live rows, optionally filtered. */
  list(filter?: (row: T) => boolean): Promise<T[]>;
  create(input: NewRow<T>): Promise<T>;
  createMany(inputs: NewRow<T>[]): Promise<T[]>;
  /** Changes some fields; bumps `updated_at`. Throws if the row is missing or deleted. */
  update(id: Uuid, patch: RowPatch<T>): Promise<T>;
  /** Soft delete. Idempotent. */
  remove(id: Uuid): Promise<void>;
  /** Undo a soft delete. */
  restore(id: Uuid): Promise<T>;
}

export class RowNotFoundError extends Error {
  constructor(table: string, id: string) {
    super(`${table} row not found: ${id}`);
    this.name = 'RowNotFoundError';
  }
}

/** Builds a full row from creation input. Exposed for the sync engine and tests. */
export function stampNewRow<T extends SyncRow>(input: NewRow<T>): T {
  const at = clock.iso();
  return {
    ...(input as object),
    id: input.id ?? newId(),
    user_id: getCurrentUserId(),
    created_at: at,
    updated_at: at,
    deleted_at: null,
  } as T;
}

/**
 * A typed repository for a syncable table. Every write runs in a transaction that also
 * writes the outbox entry, so a change is never saved without being queued for sync.
 * Calls made inside `writeTransaction(...)` join that transaction.
 */
export function createRepository<N extends SyncTableName>(
  tableName: N,
  options: { appendOnly?: boolean } = {},
): Repository<SyncTables[N]> {
  type T = SyncTables[N];
  const table = db.table<T, Uuid>(tableName);
  const rw = <R>(fn: () => Promise<R>) => db.transaction('rw', table, db.outbox, fn);
  const appendOnlyError = () => new Error(`${tableName} is append-only`);

  const repo: Repository<T> = {
    tableName,
    table,
    async get(id) {
      const row = await table.get(id);
      return isAlive(row) ? row : undefined;
    },
    getAny(id) {
      return table.get(id);
    },
    async list(filter) {
      return table.filter((row) => row.deleted_at === null && (!filter || filter(row))).toArray();
    },
    create(input) {
      return rw(async () => {
        const row = stampNewRow<T>(input);
        await table.add(row);
        await recordChange(tableName, row.id, 'upsert');
        return row;
      });
    },
    createMany(inputs) {
      return rw(async () => {
        const rows = inputs.map((i) => stampNewRow<T>(i));
        await table.bulkAdd(rows);
        for (const row of rows) await recordChange(tableName, row.id, 'upsert');
        return rows;
      });
    },
    update(id, patch) {
      if (options.appendOnly) return Promise.reject(appendOnlyError());
      return rw(async () => {
        const row = await table.get(id);
        if (!isAlive(row)) throw new RowNotFoundError(tableName, id);
        const next = { ...row, ...patch, id: row.id, updated_at: clock.iso() } as T;
        await table.put(next);
        await recordChange(tableName, id, 'upsert');
        return next;
      });
    },
    remove(id) {
      if (options.appendOnly) return Promise.reject(appendOnlyError());
      return rw(async () => {
        const row = await table.get(id);
        if (!row || row.deleted_at !== null) return;
        const at = clock.iso();
        await table.put({ ...row, deleted_at: at, updated_at: at });
        await recordChange(tableName, id, 'delete');
      });
    },
    restore(id) {
      if (options.appendOnly) return Promise.reject(appendOnlyError());
      return rw(async () => {
        const row = await table.get(id);
        if (!row) throw new RowNotFoundError(tableName, id);
        const next = { ...row, deleted_at: null, updated_at: clock.iso() } as T;
        await table.put(next);
        await recordChange(tableName, id, 'upsert');
        return next;
      });
    },
  };
  return repo;
}
