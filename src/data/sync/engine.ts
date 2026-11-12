/**
 * The sync engine: pushes the outbox in order, pulls each table by server cursor, and reacts
 * to realtime notifications, connectivity and app resume. OWNER: Cloud.
 *
 * Safety:
 * - Partial failure: an outbox entry is deleted only after the server confirmed the push, and
 *   only if the row did not change again meanwhile (`changed_at`). A pull cursor moves only
 *   after its page was applied. A crash at any point just repeats idempotent work.
 * - Two tabs: every cycle runs under one Web Lock (`navigator.locks`), so tabs take turns.
 * - Clock skew: the server corrects edit times and owns the pull cursor (see migrations).
 * - Epochs: when the account's data was replaced from another device, this device reloads.
 */
import { liveQuery, type Subscription } from 'dexie';
import { clock } from '../clock';
import { db, SYNC_TABLES } from '../db';
import type { OutboxEntry, SyncTableName, SyncTables, Uuid } from '../types';
import { applyRemoteRows } from './apply';
import { RemoteError, type SyncRemote } from './remote';
import { cursorOf, toRemote, type Cursor } from './rows';
import { clearSyncMeta, cursorKey, EPOCH_KEY, getMeta, setMeta, wipeSyncedData } from './local';

export type SyncState = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

export interface SyncStatus {
  state: SyncState;
  /** Local changes not yet on the server. */
  pending: number;
  /** Rows the server refused (kept locally, retried later). */
  failed: number;
  lastSyncedAt: string | null;
  /** Short technical reason for `error` (not shown raw to players). */
  error: string | null;
  /** True while realtime notifications are connected. */
  live: boolean;
}

export const PUSH_BATCH = 100;
export const PULL_PAGE = 500;
/** Each pull starts this far before the saved cursor, to catch rows committed out of order. */
export const PULL_OVERLAP_MS = 10_000;
/** After this many refusals a row stops blocking the queue (it is retried on later cycles). */
export const MAX_REJECTED_ATTEMPTS = 3;
/** Fallback polling when realtime is not connected. */
export const POLL_MS = 30_000;

/** Exponential backoff with jitter: 1 s, 2 s, 4 s ... up to 5 minutes. */
export function backoffDelay(failures: number, random: () => number = Math.random): number {
  const base = Math.min(300_000, 1000 * 2 ** Math.max(0, failures - 1));
  return Math.round(base * (0.75 + random() * 0.5));
}

type LockFn = <T>(fn: () => Promise<T>) => Promise<T>;

/** Cross-tab lock (Web Locks) with an in-process fallback (tests, old browsers). */
export function createSyncLock(name = 'questline-sync'): LockFn {
  let chain: Promise<unknown> = Promise.resolve();
  return <T>(fn: () => Promise<T>) => {
    const locks = (globalThis.navigator as Navigator | undefined)?.locks;
    if (locks?.request) return locks.request(name, fn) as Promise<T>;
    const next = chain.then(fn, fn);
    chain = next.catch(() => undefined);
    return next;
  };
}

export interface SyncEngineOptions {
  remote: SyncRemote;
  lock?: LockFn;
  isOnline?: () => boolean;
  /** Debounce before pushing a new local change. */
  pushDelayMs?: number;
}

export class SyncEngine {
  private readonly remote: SyncRemote;
  private readonly lock: LockFn;
  private readonly isOnline: () => boolean;
  private readonly pushDelayMs: number;
  private status: SyncStatus = {
    state: 'idle',
    pending: 0,
    failed: 0,
    lastSyncedAt: null,
    error: null,
    live: false,
  };
  private listeners = new Set<(s: SyncStatus) => void>();
  private cleanups: Array<() => void> = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private failures = 0;
  private running = false;
  private dirtyTables = new Set<SyncTableName>();
  private pullTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: SyncEngineOptions) {
    this.remote = options.remote;
    this.lock = options.lock ?? createSyncLock();
    this.isOnline = options.isOnline ?? (() => globalThis.navigator?.onLine ?? true);
    this.pushDelayMs = options.pushDelayMs ?? 1500;
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  subscribe(fn: (s: SyncStatus) => void): () => void {
    this.listeners.add(fn);
    fn(this.status);
    return () => this.listeners.delete(fn);
  }

  private setStatus(patch: Partial<SyncStatus>) {
    this.status = { ...this.status, ...patch };
    for (const fn of this.listeners) fn(this.status);
  }

  /** Starts background syncing: now, on local changes, realtime, online and resume. */
  start(): void {
    if (this.running) return;
    this.running = true;

    const outbox: Subscription = liveQuery(() => db.outbox.count()).subscribe({
      next: (count) => {
        const grew = count > this.status.pending;
        this.setStatus({ pending: count });
        if (grew) this.schedule(this.pushDelayMs);
      },
      error: () => undefined,
    });
    this.cleanups.push(() => outbox.unsubscribe());

    const onOnline = () => this.schedule(0);
    const onOffline = () => this.setStatus({ state: 'offline' });
    const onVisible = () => {
      if (document.visibilityState === 'visible') this.schedule(0);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('online', onOnline);
      window.addEventListener('offline', onOffline);
      window.addEventListener('focus', onOnline);
      document.addEventListener('visibilitychange', onVisible);
      this.cleanups.push(() => {
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
        window.removeEventListener('focus', onOnline);
        document.removeEventListener('visibilitychange', onVisible);
      });
    }

    if (this.remote.subscribe) {
      const unsubscribe = this.remote.subscribe(
        (table) => this.markDirty(table),
        (live) => {
          this.setStatus({ live });
          // Missed notifications while disconnected: catch up.
          if (live) this.schedule(0);
        },
      );
      this.cleanups.push(unsubscribe);
    }
    // Polling covers a missing or dropped realtime connection.
    this.pollTimer = setInterval(() => {
      const visible = typeof document === 'undefined' || document.visibilityState === 'visible';
      if (visible && !this.status.live) this.schedule(0);
    }, POLL_MS);

    this.schedule(0);
  }

  /** Stops background work. Pending changes stay in the outbox. */
  stop(): void {
    this.running = false;
    for (const c of this.cleanups.splice(0)) c();
    if (this.timer) clearTimeout(this.timer);
    if (this.pullTimer) clearTimeout(this.pullTimer);
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.timer = this.pullTimer = this.pollTimer = null;
    this.listeners.clear();
  }

  private schedule(ms: number) {
    if (!this.running) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.syncNow();
    }, ms);
  }

  private markDirty(table: SyncTableName) {
    this.dirtyTables.add(table);
    if (this.pullTimer) return;
    this.pullTimer = setTimeout(() => {
      this.pullTimer = null;
      const tables = [...this.dirtyTables];
      this.dirtyTables.clear();
      void this.lock(() => this.pullTables(tables)).catch((e) => this.fail(e));
    }, 250);
  }

  /** One full cycle: epoch check, push everything, pull everything. Never throws. */
  async syncNow(): Promise<SyncStatus> {
    if (!this.isOnline()) {
      this.setStatus({ state: 'offline' });
      return this.status;
    }
    this.setStatus({ state: 'syncing' });
    try {
      await this.lock(async () => {
        await this.checkEpoch();
        await this.pushAll();
        await this.pullTables(SYNC_TABLES);
      });
      this.failures = 0;
      const pending = await db.outbox.count();
      const failed = await countRejected();
      this.setStatus({
        state: failed > 0 ? 'error' : 'synced',
        error: failed > 0 ? 'rejected_rows' : null,
        pending,
        failed,
        lastSyncedAt: clock.iso(),
      });
    } catch (error) {
      this.fail(error);
    }
    return this.status;
  }

  private fail(error: unknown) {
    const kind = error instanceof RemoteError ? error.kind : 'network';
    this.failures++;
    if (!this.isOnline()) {
      this.setStatus({ state: 'offline' });
      return;
    }
    this.setStatus({
      state: 'error',
      error: kind === 'auth' ? 'auth' : String((error as Error)?.message ?? error),
    });
    if (kind !== 'auth') this.schedule(backoffDelay(this.failures));
  }

  /** If another device replaced the account's data, reload everything here. */
  async checkEpoch(): Promise<void> {
    const { epoch } = await this.remote.state();
    const known = await getMeta<number>(EPOCH_KEY);
    if (known === undefined) {
      await setMeta(EPOCH_KEY, epoch);
      return;
    }
    if (known !== epoch) {
      await wipeSyncedData();
      await clearSyncMeta();
      await setMeta(EPOCH_KEY, epoch);
    }
  }

  /** Pushes the whole outbox in `seq` order, in batches of one table each. */
  async pushAll(): Promise<void> {
    const skip = new Set<number>();
    for (;;) {
      const entries = (await db.outbox.orderBy('seq').toArray()).filter(
        (e) => !skip.has(e.seq!) && !isParked(e),
      );
      if (entries.length === 0) return;
      const table = entries[0]!.table;
      const batch: OutboxEntry[] = [];
      for (const e of entries) {
        if (e.table !== table || batch.length >= PUSH_BATCH) break;
        batch.push(e);
      }
      await this.pushBatch(table, batch, skip);
    }
  }

  /** Refused rows are marked and added to `skip` for the rest of this cycle. */
  private async pushBatch(
    table: SyncTableName,
    batch: OutboxEntry[],
    skip: Set<number>,
  ): Promise<void> {
    const t = db.table<SyncTables[typeof table], Uuid>(table);
    const rows = await t.bulkGet(batch.map((e) => e.row_id));
    const present: Array<{ entry: OutboxEntry; row: SyncTables[typeof table] }> = [];
    for (let i = 0; i < batch.length; i++) {
      const row = rows[i];
      if (row) present.push({ entry: batch[i]!, row });
      else await db.outbox.delete(batch[i]!.seq!); // nothing left to push
    }
    if (present.length === 0) return;

    try {
      const result = await this.remote.push(
        table,
        present.map((p) => toRemote(table, p.row)),
        clock.iso(),
      );
      await db.transaction('rw', db.outbox, async () => {
        for (const { entry } of present) {
          const current = await db.outbox.get(entry.seq!);
          if (current && current.changed_at === entry.changed_at) await db.outbox.delete(entry.seq!);
        }
      });
      await applyRemoteRows(table, result.rows);
    } catch (error) {
      if (!(error instanceof RemoteError) || error.kind !== 'rejected') {
        await markAttempt(present.map((p) => p.entry), errorText(error));
        throw error;
      }
      if (present.length > 1) {
        // Find the refused row(s); the others go through.
        for (const p of present) await this.pushBatch(table, [p.entry], skip);
        return;
      }
      await markAttempt([present[0]!.entry], `rejected: ${error.message}`);
      skip.add(present[0]!.entry.seq!);
    }
  }

  /** Pulls the given tables from their cursors. */
  async pullTables(tables: readonly SyncTableName[]): Promise<void> {
    for (const table of tables) {
      const saved = await getMeta<Cursor>(cursorKey(table));
      let after: Cursor | null = saved
        ? {
            ts: new Date(Date.parse(saved.ts) - PULL_OVERLAP_MS).toISOString(),
            id: '00000000-0000-0000-0000-000000000000',
          }
        : null;
      for (;;) {
        const page = await this.remote.pull(table, after, PULL_PAGE);
        if (page.rows.length === 0) break;
        await applyRemoteRows(table, page.rows);
        after = cursorOf(page.rows[page.rows.length - 1]!);
        if (!saved || Date.parse(after.ts) >= Date.parse(saved.ts)) {
          await setMeta(cursorKey(table), after);
        }
        if (page.rows.length < PULL_PAGE) break;
      }
    }
  }
}

function isParked(e: OutboxEntry): boolean {
  return e.attempts >= MAX_REJECTED_ATTEMPTS && !!e.last_error?.startsWith('rejected:');
}

async function countRejected(): Promise<number> {
  return db.outbox.filter((e) => !!e.last_error?.startsWith('rejected:')).count();
}

async function markAttempt(entries: OutboxEntry[], message: string): Promise<void> {
  await db.transaction('rw', db.outbox, async () => {
    for (const e of entries) {
      const current = await db.outbox.get(e.seq!);
      if (current)
        await db.outbox.update(e.seq!, { attempts: current.attempts + 1, last_error: message });
    }
  });
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200);
}
