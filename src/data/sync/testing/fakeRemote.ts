/**
 * In-memory stand-in for the Supabase server, faithful to the rules in supabase/migrations:
 * per-user rows, last-write-wins with skew correction and future-time clamping, unchanged
 * writes ignored, insert-only ledger, first row per natural key, server pull cursor, data
 * epochs, and change notifications. Tests only (never imported by app code).
 */
import { SYNC_TABLES } from '../../db';
import type { SyncTableName } from '../../types';
import { NATURAL_KEYS, TABLE_COLUMNS } from '../columns';
import type { Cursor, RemoteRow } from '../rows';
import { RemoteError, type RemoteErrorKind, type RemotePage, type SyncRemote } from '../remote';

type StoredRow = Record<string, unknown> & {
  id: string;
  user_id: string;
  updated_at: string;
  server_updated_at: string;
};

const SINGLETONS = new Set(['profile', 'settings', 'streak_state', 'notification_prefs']);

/** Postgres renders timestamptz as "...+00:00"; the client must cope. */
const pgTs = (iso: string) => iso.replace('Z', '+00:00');

export class FakeServer {
  /** Server clock (ms). Tests move it. */
  now = Date.parse('2026-03-10T09:00:00.000Z');
  private lastStamp = 0;
  readonly tables = new Map<SyncTableName, Map<string, StoredRow>>(
    SYNC_TABLES.map((t) => [t, new Map()]),
  );
  private epochs = new Map<string, number>();
  private listeners = new Set<{ userId: string; fn: (t: SyncTableName) => void }>();
  /** Every push call, for assertions about order. */
  readonly pushLog: Array<{ userId: string; table: SyncTableName; ids: string[] }> = [];
  private failures: RemoteErrorKind[] = [];
  /** Simulates no connection at all. */
  offline = false;
  /** Rows (by id) the server refuses, e.g. invalid data. */
  readonly rejectIds = new Set<string>();

  /** The next `count` calls fail with `kind`. */
  failNext(count: number, kind: RemoteErrorKind = 'network'): void {
    for (let i = 0; i < count; i++) this.failures.push(kind);
  }

  private gate(): void {
    if (this.offline) throw new RemoteError('network', 'offline');
    const kind = this.failures.shift();
    if (kind) throw new RemoteError(kind, `injected ${kind} failure`);
  }

  private stamp(): string {
    this.lastStamp = Math.max(this.now, this.lastStamp + 1);
    return new Date(this.lastStamp).toISOString();
  }

  rowsOf(userId: string, table: SyncTableName): StoredRow[] {
    return [...this.tables.get(table)!.values()].filter((r) => r.user_id === userId);
  }

  private notify(userId: string, table: SyncTableName) {
    for (const l of this.listeners) if (l.userId === userId) l.fn(table);
  }

  private render(row: StoredRow): RemoteRow {
    const columns = TABLE_COLUMNS[row.__table as SyncTableName] as Record<string, string>;
    const out: RemoteRow = {};
    for (const [k, type] of Object.entries(columns)) {
      const v = row[k];
      out[k] = type === 'ts' && typeof v === 'string' ? pgTs(v) : (v ?? null);
    }
    out.server_updated_at = pgTs(row.server_updated_at);
    return out;
  }

  /** A remote bound to one signed-in user (like a Supabase session). */
  remote(userId: string): SyncRemote & { live: boolean } {
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- closures below need the server
    const server = this;
    return {
      live: true,
      async state() {
        server.gate();
        return {
          epoch: server.epochs.get(userId) ?? 0,
          serverNow: pgTs(new Date(server.now).toISOString()),
        };
      },
      async push(table, rows, clientNow) {
        server.gate();
        if (!SYNC_TABLES.includes(table)) throw new RemoteError('rejected', 'unknown table');
        if (rows.some((r) => server.rejectIds.has(String(r.id)))) {
          throw new RemoteError('rejected', 'row refused');
        }
        server.pushLog.push({ userId, table, ids: rows.map((r) => String(r.id)) });
        const store = server.tables.get(table)!;
        const serverNow = server.now;
        const skewMs =
          Math.abs(serverNow - Date.parse(clientNow)) > 2000
            ? serverNow - Date.parse(clientNow)
            : 0;
        const naturalKey = NATURAL_KEYS[table];
        const touched = new Set<string>();
        const keys = new Set<unknown>();
        for (const input of rows) {
          const id = String(input.id);
          touched.add(id);
          if (naturalKey) keys.add(input[naturalKey]);
          let updated = Date.parse(String(input.updated_at)) + skewMs;
          if (!(updated <= serverNow)) updated = serverNow;
          const next: StoredRow = {
            ...input,
            __table: table,
            id,
            user_id: userId,
            updated_at: new Date(updated).toISOString(),
            server_updated_at: '',
          };
          const existing = store.get(id);
          if (existing && existing.user_id !== userId) {
            throw new RemoteError('rejected', 'row-level security');
          }
          if (naturalKey) {
            const twin = [...store.values()].find(
              (r) =>
                r.user_id === userId &&
                r.id !== id &&
                r[naturalKey] === input[naturalKey] &&
                (table !== 'achievements' || r.deleted_at === null),
            );
            if (twin) continue;
          }
          if (existing) {
            if (table === 'ledger_events') continue;
            next.created_at = existing.created_at;
            if (next.updated_at < existing.updated_at) continue;
            const { server_updated_at: _a, ...a } = existing;
            const { server_updated_at: _b, ...b } = next;
            if (JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b))) continue;
          }
          next.server_updated_at = server.stamp();
          store.set(id, next);
        }
        const out = [...store.values()].filter(
          (r) =>
            r.user_id === userId &&
            (touched.has(r.id) || (naturalKey !== undefined && keys.has(r[naturalKey]))),
        );
        server.notify(userId, table);
        return {
          rows: out.map((r) => server.render(r)),
          serverNow: pgTs(new Date(serverNow).toISOString()),
        };
      },
      async pull(table, after: Cursor | null, limit) {
        server.gate();
        const afterTs = after ? Date.parse(after.ts) : -Infinity;
        const afterId = after?.id ?? '';
        const rows = server
          .rowsOf(userId, table)
          .map((r) => ({ r, ts: Date.parse(r.server_updated_at) }))
          .filter(({ r, ts }) => ts > afterTs || (ts === afterTs && r.id > afterId))
          .sort((x, y) => x.ts - y.ts || (x.r.id < y.r.id ? -1 : 1))
          .slice(0, limit)
          .map(({ r }) => server.render(r));
        return { rows, serverNow: pgTs(new Date(server.now).toISOString()) } satisfies RemotePage;
      },
      async hasData() {
        server.gate();
        for (const table of SYNC_TABLES) {
          if (SINGLETONS.has(table)) continue;
          const live = server.rowsOf(userId, table).filter((r) => r.deleted_at === null);
          if (table === 'categories') {
            if (live.some((c) => c.name_key === null || (c.name ?? '') !== '')) return true;
          } else if (live.length) return true;
        }
        return false;
      },
      async resetData() {
        server.gate();
        for (const store of server.tables.values()) {
          for (const [id, r] of store) if (r.user_id === userId) store.delete(id);
        }
        const epoch = (server.epochs.get(userId) ?? 0) + 1;
        server.epochs.set(userId, epoch);
        return epoch;
      },
      subscribe(onChange, onStatus) {
        const entry = { userId, fn: onChange };
        server.listeners.add(entry);
        onStatus(true);
        return () => server.listeners.delete(entry);
      },
    };
  }
}

function sortKeys(o: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));
}
