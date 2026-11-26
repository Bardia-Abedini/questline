import { localMeta } from '@/data/bootstrap';

/** Device-local flag (local_meta, never synced): the "works offline" toast was shown here. */
export const OFFLINE_READY_SHOWN_KEY = 'offline_ready_shown';

/** Runs `show` only if this device has never shown the "works offline" toast. */
export async function showOfflineReadyOnce(show: () => void): Promise<boolean> {
  try {
    if (await localMeta.get<boolean>(OFFLINE_READY_SHOWN_KEY)) return false;
    await localMeta.set(OFFLINE_READY_SHOWN_KEY, true);
  } catch {
    return false;
  }
  show();
  return true;
}
