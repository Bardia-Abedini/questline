/** Sync engine public API. OWNER: Cloud. Import from '@/data/sync'. */
export {
  SyncEngine,
  backoffDelay,
  createSyncLock,
  type SyncStatus,
  type SyncState,
} from './engine';
export { RemoteError, type SyncRemote, type RemoteErrorKind } from './remote';
export { createSupabaseRemote } from './supabaseRemote';
export {
  connectAccount,
  resolveAccountChoice,
  resetToGuest,
  exportAllData,
  hasGuestData,
  getDataOwner,
  claimLocalRows,
  type AccountChoice,
  type ConnectResult,
} from './account';
export { applyRemoteRows } from './apply';
export { fromRemote, toRemote } from './rows';
export { TABLE_COLUMNS } from './columns';
export { OWNER_KEY } from './local';
