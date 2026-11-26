import { useCloud } from '../store';

export type BadgeState = 'guest' | 'syncing' | 'synced' | 'offline' | 'error';

export function useBadgeState(): BadgeState {
  return useCloud((s) => {
    if (s.auth !== 'signed_in') return 'guest';
    if (!s.online) return 'offline';
    const sync = s.sync?.state;
    if (sync === 'error') return 'error';
    if (sync === 'offline') return 'offline';
    if (sync === 'synced' && (s.sync?.pending ?? 0) === 0) return 'synced';
    return 'syncing';
  });
}
