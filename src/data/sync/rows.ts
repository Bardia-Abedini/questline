/**
 * Converting rows between the local shape (Dexie) and the server's JSON (PostgREST / RPC).
 * The server returns timestamps as "2026-03-10T09:15:00.123+00:00" with microseconds and
 * extra server-only columns; locally every timestamp is `Date#toISOString()` and rows carry
 * exactly the fields of their type.
 */
import type { SyncTableName, SyncTables } from '../types';
import { TABLE_COLUMNS, type ColumnType } from './columns';

/** A row as JSON from the server, including `server_updated_at`. */
export type RemoteRow = Record<string, unknown>;

/** Position in a table's pull stream: the server's `server_updated_at` (verbatim) and id. */
export interface Cursor {
  ts: string;
  id: string;
}

function normalizeValue(type: ColumnType, value: unknown): unknown {
  if (value === undefined || value === null) return null;
  switch (type) {
    case 'ts': {
      const ms = Date.parse(String(value));
      return Number.isNaN(ms) ? null : new Date(ms).toISOString();
    }
    case 'date':
      return String(value).slice(0, 10);
    case 'int':
    case 'bigint':
    case 'float': {
      const n = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(n) ? n : null;
    }
    case 'bool':
      return value === true || value === 'true';
    default:
      return value;
  }
}

/** A server row as a local row of `table` (only known columns, local formats). */
export function fromRemote<N extends SyncTableName>(table: N, raw: RemoteRow): SyncTables[N] {
  const columns = TABLE_COLUMNS[table] as Record<string, ColumnType>;
  const row: Record<string, unknown> = {};
  for (const [name, type] of Object.entries(columns)) row[name] = normalizeValue(type, raw[name]);
  return row as unknown as SyncTables[N];
}

/** A local row as the JSON the server expects (only known columns). */
export function toRemote<N extends SyncTableName>(
  table: N,
  row: SyncTables[N],
): Record<string, unknown> {
  const columns = TABLE_COLUMNS[table] as Record<string, ColumnType>;
  const source = row as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const name of Object.keys(columns)) out[name] = source[name] ?? null;
  return out;
}

/** The pull cursor of a server row. */
export function cursorOf(raw: RemoteRow): Cursor {
  return { ts: String(raw.server_updated_at), id: String(raw.id) };
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/** Whether two rows of `table` hold the same data (key order and missing/null ignored). */
export function sameRow<N extends SyncTableName>(
  table: N,
  a: SyncTables[N],
  b: SyncTables[N],
): boolean {
  return stable(toRemote(table, a)) === stable(toRemote(table, b));
}
