import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { PATHS } from '@/app/routing';
import { buttonClass, EmptyState } from '@/ui';

/**
 * Focus mode: full screen, no app chrome (plan section 3). OWNER: Focus package.
 * Replace this placeholder with the timer, quest title, current and next step, and the
 * Done / Pause / I got distracted / Quick capture / Stop buttons.
 */
export function FocusPage() {
  const { t } = useTranslation('focus');
  return (
    <main id="main" className="grid min-h-dvh place-items-center p-6">
      <EmptyState
        icon="timer"
        title={t('placeholder.title')}
        action={
          <Link to={PATHS.today} className={buttonClass('secondary')}>
            {t('placeholder.back')}
          </Link>
        }
      >
        {t('placeholder.body')}
      </EmptyState>
    </main>
  );
}
