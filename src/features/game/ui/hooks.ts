import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { db, useProfile } from '@/data';
import { STARTER_IDS } from '../catalog/cosmetics';
import { lookFromProfile, resolveRoom } from '../logic/looks';

/**
 * `t` for keys built at runtime (item names, achievement names...). The catalogue test
 * guarantees every such key exists in both languages.
 */
export function useGameT() {
  const { t } = useTranslation('game');
  const tx = useCallback(
    (key: string, options?: Record<string, unknown>) =>
      t(key as 'home.title', options as never) as unknown as string,
    [t],
  );
  return { t, tx };
}

/** Owned cosmetic ids (starter items included), live. */
export function useOwnedCosmetics(): Set<string> | undefined {
  return useLiveQuery(async () => {
    const rows = await db.inventory.where('kind').equals('cosmetic').toArray();
    return new Set([
      ...STARTER_IDS,
      ...rows.filter((r) => r.deleted_at === null).map((r) => r.ref_id),
    ]);
  }, []);
}

/** The profile's avatar look and resolved room, live. */
export function useLooks() {
  const profile = useProfile();
  return {
    profile,
    look: lookFromProfile(profile?.avatar),
    room: resolveRoom(profile?.cottage),
  };
}
