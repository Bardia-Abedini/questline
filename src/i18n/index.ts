import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LANGUAGE, LANGUAGE_DIR, NAMESPACES, type Language } from './config';
import { resources } from './resources';

export * from './config';
export * from './format';
export { resources };

/** Sets `lang` and `dir` on <html>, which drives fonts (Vazirmatn) and RTL layout. */
export function applyDocumentLanguage(lang: Language, doc: Document = document): void {
  doc.documentElement.lang = lang;
  doc.documentElement.dir = LANGUAGE_DIR[lang];
}

let initialized = false;

/** Initializes i18next once. Resources are bundled, so this is synchronous in practice. */
export function initI18n(lang: Language = DEFAULT_LANGUAGE) {
  if (!initialized) {
    initialized = true;
    void i18next.use(initReactI18next).init({
      resources,
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
    void i18next.changeLanguage(lang);
  }
  if (typeof document !== 'undefined') applyDocumentLanguage(lang);
  return i18next;
}

/** Switches language and direction. */
export async function setLanguage(lang: Language): Promise<void> {
  await i18next.changeLanguage(lang);
  if (typeof document !== 'undefined') applyDocumentLanguage(lang);
}

export { i18next };
