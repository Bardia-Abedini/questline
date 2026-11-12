import { ensureLocalData } from '@/data/bootstrap';
import { detectLanguage, initI18n, isLanguage } from '@/i18n';
import { applyInitialPreferences, readSnapshot } from './preferences/preferences';
import { setupFeatures } from './features';

/**
 * Start-up order: apply cached appearance (no flash), start i18n, make sure the local
 * database has its one-row tables, then run every package's setup hook.
 */
export async function bootstrap(): Promise<void> {
  applyInitialPreferences();
  const cached = readSnapshot().language;
  const language = isLanguage(cached) ? cached : detectLanguage(navigator);
  initI18n(language);
  await ensureLocalData({
    language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  setupFeatures();
}
