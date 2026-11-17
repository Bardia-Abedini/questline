import { ensureLocalData } from '@/data/bootstrap';
import { detectLanguage, initI18n, isLanguage, loadLanguage } from '@/i18n';
import {
  applyInitialPreferences,
  readSnapshot,
  snapshotAsSettings,
} from './preferences/preferences';
import { setupFeatures } from './features';

/**
 * Start-up order: apply cached appearance (no flash), start i18n, make sure the local
 * database has its one-row tables, then run every package's setup hook.
 */
export async function bootstrap(): Promise<void> {
  applyInitialPreferences();
  const snapshot = readSnapshot();
  const cached = snapshot.language;
  const language = isLanguage(cached) ? cached : detectLanguage(navigator);
  await loadLanguage(language).catch((e: unknown) => console.error('[i18n] load', e));
  initI18n(language);
  await ensureLocalData({
    language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    // A new database (first visit, or storage cleared) keeps the appearance cached on this device.
    settings: snapshotAsSettings(snapshot),
  });
  setupFeatures();
}
