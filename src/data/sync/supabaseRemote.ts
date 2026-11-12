/**
 * The real server: Supabase RPC functions from supabase/migrations and Realtime for change
 * notifications. The client is passed in, so this module adds nothing to the bundle on its own.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { SYNC_TABLES } from '../db';
import type { SyncTableName } from '../types';
import { RemoteError, type RemoteErrorKind, type RemotePage, type SyncRemote } from './remote';
import type { RemoteRow } from './rows';

interface PostgrestLikeError {
  message?: string;
  code?: string;
  status?: number;
}

/** Maps a PostgREST / network error to retry semantics. */
export function classifyError(error: PostgrestLikeError, status?: number): RemoteErrorKind {
  const code = error.code ?? '';
  const http = status ?? error.status ?? 0;
  if (
    http === 401 ||
    code === 'PGRST301' ||
    code === 'PGRST303' ||
    /jwt/i.test(error.message ?? '')
  )
    return 'auth';
  if (code === '42501' && /not signed in/i.test(error.message ?? '')) return 'auth';
  // SQL errors (22xxx data, 23xxx constraint, 42xxx privilege/RLS) mean this data is refused.
  if (/^(22|23|42|P0)/.test(code) || http === 400 || http === 403 || http === 409)
    return 'rejected';
  return 'network';
}

export function createSupabaseRemote(client: SupabaseClient, userId: string): SyncRemote {
  async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
    let result;
    try {
      result = await client.rpc(fn, args);
    } catch (e) {
      throw new RemoteError('network', e instanceof Error ? e.message : String(e));
    }
    if (result.error) {
      throw new RemoteError(
        classifyError(result.error, result.status),
        result.error.message ?? 'request failed',
      );
    }
    return result.data as T;
  }

  const page = (data: { rows?: RemoteRow[]; server_now?: string }): RemotePage => ({
    rows: Array.isArray(data?.rows) ? data.rows : [],
    serverNow: String(data?.server_now ?? ''),
  });

  return {
    async state() {
      const data = await rpc<{ epoch: number; server_now: string }>('sync_state');
      return { epoch: Number(data.epoch ?? 0), serverNow: String(data.server_now) };
    },
    async push(table, rows, clientNow) {
      return page(
        await rpc('sync_push', { p_table: table, p_rows: rows, p_client_now: clientNow }),
      );
    },
    async pull(table, after, limit) {
      return page(
        await rpc('sync_pull', {
          p_table: table,
          p_after_ts: after?.ts ?? null,
          p_after_id: after?.id ?? null,
          p_limit: limit,
        }),
      );
    },
    async hasData() {
      return Boolean(await rpc<boolean>('account_has_data'));
    },
    async resetData() {
      return Number(await rpc<number>('reset_my_data'));
    },
    subscribe(onChange, onStatus) {
      let channel = client.channel(`sync:${userId}`);
      for (const table of SYNC_TABLES) {
        channel = channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` },
          () => onChange(table as SyncTableName),
        );
      }
      channel.subscribe((status) => {
        onStatus(status === 'SUBSCRIBED');
      });
      return () => {
        void client.removeChannel(channel);
      };
    },
  };
}
