/**
 * What the sync engine needs from the server. The real implementation talks to Supabase
 * (supabaseRemote.ts); tests use an in-memory fake with the same rules (testing/fakeRemote.ts).
 */
import type { SyncTableName } from '../types';
import type { Cursor, RemoteRow } from './rows';

export interface RemoteState {
  /** Changes when the account's data was replaced from one device; others then reload. */
  epoch: number;
  serverNow: string;
}

export interface RemotePage {
  rows: RemoteRow[];
  serverNow: string;
}

export interface SyncRemote {
  state(): Promise<RemoteState>;
  /**
   * Stores rows (last write wins per row, ledger insert-only, first row per natural key) and
   * returns what the server kept for them. `clientNow` lets the server correct clock skew.
   */
  push(
    table: SyncTableName,
    rows: Record<string, unknown>[],
    clientNow: string,
  ): Promise<RemotePage>;
  /** Rows changed after `after` (exclusive), oldest first, at most `limit`. */
  pull(table: SyncTableName, after: Cursor | null, limit: number): Promise<RemotePage>;
  /** Whether the account holds anything beyond per-device defaults. */
  hasData(): Promise<boolean>;
  /** Removes all of the account's synced data and starts a new epoch (returned). */
  resetData(): Promise<number>;
  /**
   * Near real-time change notifications. Calls `onChange` with the table that changed, and
   * `onStatus(true|false)` when the live connection comes up or drops. Optional.
   */
  subscribe?(
    onChange: (table: SyncTableName) => void,
    onStatus: (live: boolean) => void,
  ): () => void;
}

export type RemoteErrorKind =
  /** No connection, timeout, 5xx, rate limit: try again later. */
  | 'network'
  /** The session is missing or expired. */
  | 'auth'
  /** The server refused this data; retrying the same rows will not help. */
  | 'rejected';

export class RemoteError extends Error {
  constructor(
    public readonly kind: RemoteErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'RemoteError';
  }
}
