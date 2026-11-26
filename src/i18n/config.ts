/** Supported languages and their direction. */
export const LANGUAGES = ['en', 'fa'] as const;
export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'en';

export const LANGUAGE_DIR: Readonly<Record<Language, 'ltr' | 'rtl'>> = { en: 'ltr', fa: 'rtl' };

/** Locale tags for Intl formatting. Persian uses the Persian (Jalali) calendar and Persian digits. */
export const INTL_LOCALE: Readonly<Record<Language, string>> = {
  en: 'en-US',
  fa: 'fa-IR-u-ca-persian-nu-arabext',
};

/**
 * Translation namespaces, one JSON file per namespace per language in ./locales/<lang>/.
 * Each package owns its own namespace files, so parallel work never edits the same JSON.
 */
export const NAMESPACES = [
  'common',
  'settings',
  'dev',
  'today',
  'quests',
  'focus',
  'game',
  'cloud',
  'stats',
  'insights',
  'onboarding',
] as const;
export type Namespace = (typeof NAMESPACES)[number];

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

/** Best guess from the browser for a first visit. */
export function detectLanguage(
  nav: Pick<Navigator, 'languages' | 'language'> | undefined,
): Language {
  const list = nav ? [...(nav.languages ?? []), nav.language] : [];
  for (const tag of list) {
    const base = tag?.toLowerCase().split('-')[0];
    if (isLanguage(base)) return base;
  }
  return DEFAULT_LANGUAGE;
}
