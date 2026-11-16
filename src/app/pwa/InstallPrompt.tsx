import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { events } from '@/services';
import { showToast } from '@/ui';

const OFFERED_KEY = 'ql.install.offered';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function offeredBefore(): boolean {
  try {
    return localStorage.getItem(OFFERED_KEY) === '1';
  } catch {
    return true;
  }
}

/**
 * Offers to install the app at a good moment: right after the player finishes their first
 * quest (a win), never on first load, and only once per device. Browsers without an install
 * prompt (Safari) are left alone; they have "Add to Home Screen".
 */
export function InstallPrompt() {
  const { t } = useTranslation('common');

  useEffect(() => {
    if (offeredBefore()) return;
    let deferred: InstallPromptEvent | null = null;
    const onBefore = (e: Event) => {
      e.preventDefault();
      deferred = e as InstallPromptEvent;
    };
    window.addEventListener('beforeinstallprompt', onBefore);
    const off = events.on('quest.completed', () => {
      if (!deferred || offeredBefore()) return;
      try {
        localStorage.setItem(OFFERED_KEY, '1');
      } catch {
        /* offered at most once per visit then */
      }
      const prompt = deferred;
      deferred = null;
      // A moment after the reward celebration, not on top of it.
      window.setTimeout(
        () =>
          showToast({
            tone: 'info',
            icon: 'sparkle',
            title: t('pwa.install_title'),
            description: t('pwa.install_body'),
            duration: 12_000,
            action: { label: t('pwa.install_action'), onClick: () => void prompt.prompt() },
          }),
        2500,
      );
    });
    return () => {
      window.removeEventListener('beforeinstallprompt', onBefore);
      off();
    };
  }, [t]);

  return null;
}
