/**
 * Appearance and accessibility preferences: theme, language, text size, font, motion,
 * sound and haptics.
 *
 * Source of truth is the synced `settings` row in the database. This Zustand store mirrors
 * it for instant reads, applies it to <html> (data-theme, lang, dir, data-text-size,
 * data-font, data-motion) and caches a snapshot in localStorage so the first paint of the
 * next visit already has the right theme and direction (see the inline script in index.html).
 *
 * Read with `usePreferences(selector)`. Change with `setPreferences(patch)`.
 */
import { create } from 'zustand';
import type {
  FontPref,
  LanguagePref,
  MotionPref,
  Settings,
  TextSize,
  ThemePref,
} from '@/data/types';
import { updateSettings } from '@/data/repositories';
import { isLanguage, setLanguage } from '@/i18n';

export interface Preferences {
  theme: ThemePref;
  language: LanguagePref;
  textSize: TextSize;
  font: FontPref;
  motion: MotionPref;
  sound: boolean;
  haptics: boolean;
}

export interface ResolvedAppearance {
  theme: 'light' | 'dark';
  reduceMotion: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'system',
  language: 'en',
  textSize: 'normal',
  font: 'default',
  motion: 'system',
  sound: true,
  haptics: true,
};

export const SNAPSHOT_KEY = 'ql:prefs';

interface PreferencesState extends Preferences {
  resolved: ResolvedAppearance;
  /** True once the database row has been read. */
  hydrated: boolean;
}

function systemDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}

function systemReduceMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function resolveAppearance(p: Pick<Preferences, 'theme' | 'motion'>): ResolvedAppearance {
  return {
    theme: p.theme === 'system' ? (systemDark() ? 'dark' : 'light') : p.theme,
    reduceMotion: p.motion === 'system' ? systemReduceMotion() : p.motion === 'reduce',
  };
}

export function readSnapshot(): Partial<Preferences> {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    return raw ? (JSON.parse(raw) as Partial<Preferences>) : {};
  } catch {
    return {};
  }
}

function writeSnapshot(p: Preferences): void {
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(p));
  } catch {
    /* storage can be unavailable (private mode); the database still has the truth */
  }
}

const initial: Preferences = { ...DEFAULT_PREFERENCES, ...readSnapshot() };

export const usePreferences = create<PreferencesState>(() => ({
  ...initial,
  resolved: resolveAppearance(initial),
  hydrated: false,
}));

/** Applies preferences to <html>. Pure DOM work; safe to call often. */
export function applyToDocument(
  p: Preferences,
  resolved: ResolvedAppearance,
  doc: Document = document,
): void {
  const el = doc.documentElement;
  el.dataset.theme = resolved.theme;
  el.dataset.textSize = p.textSize;
  el.dataset.font = p.font;
  el.dataset.motion = resolved.reduceMotion ? 'reduce' : 'full';
  const meta = doc.querySelector('meta[name="theme-color"]');
  meta?.setAttribute('content', resolved.theme === 'dark' ? '#1b1725' : '#f6ead6');
}

function commit(next: Preferences, hydrated?: boolean): void {
  const prev = usePreferences.getState();
  const resolved = resolveAppearance(next);
  usePreferences.setState({ ...next, resolved, ...(hydrated !== undefined ? { hydrated } : {}) });
  if (typeof document !== 'undefined') applyToDocument(next, resolved);
  if (prev.language !== next.language || document.documentElement.lang !== next.language) {
    void setLanguage(next.language);
  }
  writeSnapshot(next);
}

function pick(s: PreferencesState): Preferences {
  return {
    theme: s.theme,
    language: s.language,
    textSize: s.textSize,
    font: s.font,
    motion: s.motion,
    sound: s.sound,
    haptics: s.haptics,
  };
}

/** Maps the database row onto the store (called whenever the row changes, e.g. after sync). */
export function hydrateFromSettings(row: Settings): void {
  commit(
    {
      theme: row.theme,
      language: isLanguage(row.language) ? row.language : 'en',
      textSize: row.text_size,
      font: row.font,
      motion: row.motion,
      sound: row.sound,
      haptics: row.haptics,
    },
    true,
  );
}

const TO_COLUMN = {
  theme: 'theme',
  language: 'language',
  textSize: 'text_size',
  font: 'font',
  motion: 'motion',
  sound: 'sound',
  haptics: 'haptics',
} as const satisfies Record<keyof Preferences, keyof Settings>;

/** Changes preferences: applies at once, then saves to the database (and so syncs). */
export async function setPreferences(patch: Partial<Preferences>): Promise<void> {
  commit({ ...pick(usePreferences.getState()), ...patch });
  const columns: Partial<Settings> = {};
  for (const [key, value] of Object.entries(patch) as Array<[keyof Preferences, never]>) {
    (columns as Record<string, unknown>)[TO_COLUMN[key]] = value;
  }
  await updateSettings(columns);
}

/** Re-resolves "system" theme/motion when the device setting changes. Returns a cleanup. */
export function watchSystemPreferences(): () => void {
  if (typeof matchMedia !== 'function') return () => {};
  const queries = [
    matchMedia('(prefers-color-scheme: dark)'),
    matchMedia('(prefers-reduced-motion: reduce)'),
  ];
  const onChange = () => commit(pick(usePreferences.getState()));
  queries.forEach((q) => q.addEventListener('change', onChange));
  return () => queries.forEach((q) => q.removeEventListener('change', onChange));
}

const VALID: { [K in keyof Preferences]: readonly unknown[] } = {
  theme: ['system', 'light', 'dark'],
  language: ['en', 'fa'],
  textSize: ['normal', 'large', 'larger'],
  font: ['default', 'dyslexic'],
  motion: ['system', 'reduce', 'full'],
  sound: [true, false],
  haptics: [true, false],
};

/**
 * Valid cached preferences as settings columns, used to seed the settings row on a
 * brand-new database so the device keeps what it showed before (all fields, not just
 * language). Unknown or invalid values are dropped.
 */
export function snapshotAsSettings(
  snapshot: Partial<Preferences> = readSnapshot(),
): Partial<Settings> {
  const out: Partial<Settings> = {};
  for (const key of Object.keys(TO_COLUMN) as Array<keyof Preferences>) {
    const value = snapshot[key];
    if (value !== undefined && VALID[key].includes(value)) {
      (out as Record<string, unknown>)[TO_COLUMN[key]] = value;
    }
  }
  return out;
}

/** Applies the cached snapshot before the first render. */
export function applyInitialPreferences(): void {
  const s = usePreferences.getState();
  applyToDocument(pick(s), s.resolved);
}
