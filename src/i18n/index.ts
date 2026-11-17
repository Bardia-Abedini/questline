import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LANGUAGE, LANGUAGE_DIR, NAMESPACES, type Language } from './config';
import { resources } from './resources';

export * from './config';
export * from './format';
export { resources };

type Bundle = Record<string, object>;

/** Languages whose translations are in memory. English is always bundled. */
const loaded: Partial<Record<Language, Bundle>> = { en: resources.en };

/**
 * Makes sure a language's translations are loaded (Persian is a separate chunk). Call before
 * switching to it; `setLanguage` and the app's start-up do.
 */
export async function loadLanguage(lang: Language): Promise<void> {
  if (loaded[lang]) return;
  const { fa } = await import('./resourcesFa');
  loaded.fa = fa as unknown as Bundle;
  if (initialized) {
    for (const [ns, bundle] of Object.entries(loaded.fa)) {
      i18next.addResourceBundle('fa', ns, bundle, true, true);
    }
  }
}

/** Sets `lang` and `dir` on <html>, which drives fonts (Vazirmatn) and RTL layout. */
export function applyDocumentLanguage(lang: Language, doc: Document = document): void {
  doc.documentElement.lang = lang;
  doc.documentElement.dir = LANGUAGE_DIR[lang];
}

let initialized = false;

/**
 * Initializes i18next once, synchronously, with the languages already loaded. For a language
 * that is not loaded yet, call `await loadLanguage(lang)` first (start-up does).
 */
export function initI18n(lang: Language = DEFAULT_LANGUAGE) {
  if (!initialized) {
    initialized = true;
    void i18next.use(initReactI18next).init({
      resources: loaded as typeof resources,
      lng: lang,
      fallbackLng: DEFAULT_LANGUAGE,
      ns: [...NAMESPACES],
      defaultNS: 'common',
      interpolation: { escapeValue: false },
      returnNull: false,
      initAsync: false,
      react: { useSuspense: false },
    });
  } else if (i18next.language !== lang) {
    void loadLanguage(lang).then(() => i18next.changeLanguage(lang));
  }
  if (typeof document !== 'undefined') applyDocumentLanguage(lang);
  return i18next;
}

/** Switches language and direction. */
export async function setLanguage(lang: Language): Promise<void> {
  await loadLanguage(lang);
  await i18next.changeLanguage(lang);
  if (typeof document !== 'undefined') applyDocumentLanguage(lang);
}

export { i18next };
