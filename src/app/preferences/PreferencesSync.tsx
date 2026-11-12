import { useEffect } from 'react';
import { useSettings } from '@/data/hooks';
import { hydrateFromSettings, watchSystemPreferences } from './preferences';

/** Keeps the preferences store in step with the synced settings row and the device. */
export function PreferencesSync() {
  const settings = useSettings();
  useEffect(() => {
    if (settings) hydrateFromSettings(settings);
  }, [settings]);
  useEffect(() => watchSystemPreferences(), []);
  return null;
}
