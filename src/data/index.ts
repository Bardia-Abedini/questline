/**
 * Data layer public API. Feature code imports from '@/data' only.
 */
export * from './types';
export { db, DB_NAME, SYNC_TABLES, SINGLETON_TABLES, QuestlineDB } from './db';
export type { SingletonTableName } from './db';
export { clock, setClock } from './clock';
export { newId, UUID_RE } from './ids';
export { getCurrentUserId, setCurrentUserId } from './session';
export { writeTransaction, afterCommit } from './transaction';
export { toMs, toIso, sessionToTimerState, spanToMs } from './timestamps';
export { ensureLocalData, getDeviceId, localMeta } from './bootstrap';
export { getPlayerStats, type PlayerStats } from './derived';
export * from './repositories';
export * from './defaults';
export * from './hooks';
