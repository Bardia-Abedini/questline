import { db } from './db';
import { newId } from './ids';
import { categoriesRepo, ensureSingleton } from './repositories';
import {
  defaultCategories,
  defaultNotificationPrefs,
  defaultProfile,
  defaultSettings,
  defaultStreakState,
} from './defaults';
import type { LanguagePref, NewRow, Settings } from './types';

const SEEDED_KEY = 'seeded_v1';
const DEVICE_ID_KEY = 'device_id';

export interface BootstrapOptions {
  /** Language for a brand-new install (from the browser). */
  language?: LanguagePref;
  /** IANA time zone of the device. */
  timezone?: string;
  /**
   * Initial values for a brand-new settings row (e.g. appearance preferences cached on this
   * device). Ignored when the row already exists.
   */
  settings?: Partial<NewRow<Settings>>;
}

/**
 * Makes sure the one-row tables exist and the default categories are seeded. Safe to call
 * on every start and from several tabs: it runs in one transaction and only creates what
 * is missing. Default categories are seeded once per database, so deleting them sticks.
 */
export async function ensureLocalData(options: BootstrapOptions = {}): Promise<void> {
  const language = options.language ?? 'en';
  const timezone = options.timezone ?? 'UTC';
  await db.transaction(
    'rw',
    [
      db.settings,
      db.profile,
      db.streak_state,
      db.notification_prefs,
      db.categories,
      db.outbox,
      db.local_meta,
    ],
    async () => {
      await ensureSingleton('settings', {
        ...defaultSettings(language),
        ...options.settings,
        language,
      });
      await ensureSingleton('profile', defaultProfile(timezone));
      await ensureSingleton('streak_state', defaultStreakState());
      await ensureSingleton('notification_prefs', defaultNotificationPrefs());
      if (!(await db.local_meta.get(SEEDED_KEY))) {
        await categoriesRepo.createMany(defaultCategories());
        await db.local_meta.put({ key: SEEDED_KEY, value: true });
      }
      if (!(await db.local_meta.get(DEVICE_ID_KEY))) {
        await db.local_meta.put({ key: DEVICE_ID_KEY, value: newId() });
      }
    },
  );
}

/** A stable id for this browser profile (stored in local_meta). */
export async function getDeviceId(): Promise<string> {
  const row = await db.local_meta.get(DEVICE_ID_KEY);
  if (typeof row?.value === 'string') return row.value;
  const id = newId();
  await db.local_meta.put({ key: DEVICE_ID_KEY, value: id });
  return id;
}

/** Device-local key/value helpers (never synced). */
export const localMeta = {
  async get<T>(key: string): Promise<T | undefined> {
    return (await db.local_meta.get(key))?.value as T | undefined;
  },
  async set(key: string, value: unknown): Promise<void> {
    await db.local_meta.put({ key, value });
  },
  async remove(key: string): Promise<void> {
    await db.local_meta.delete(key);
  },
};
