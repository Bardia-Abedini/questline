import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { dismissToast, showToast } from '@/ui';
import { showOfflineReadyOnce } from './offlineReady';

/**
 * Registers the service worker (production builds only) and shows a toast when a new
 * version is waiting, with a Reload button that activates it. Also tells the player once
 * that the app now works offline.
 */
export function UpdatePrompt() {
  const { t } = useTranslation('common');

  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    let cancelled = false;
    let toastId: number | null = null;
    void import('virtual:pwa-register').then(({ registerSW }) => {
      if (cancelled) return;
      const updateSW = registerSW({
        onNeedRefresh() {
          if (toastId !== null) dismissToast(toastId);
          toastId = showToast({
            tone: 'info',
            icon: 'sparkle',
            title: t('pwa.update_title'),
            description: t('pwa.update_body'),
            duration: 0,
            action: { label: t('pwa.update_action'), onClick: () => void updateSW(true) },
          });
        },
        onOfflineReady() {
          // Once ever per device, not once per visit.
          void showOfflineReadyOnce(() =>
            showToast({ tone: 'success', icon: 'cloud', title: t('pwa.offline_ready') }),
          );
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [t]);

  return null;
}
