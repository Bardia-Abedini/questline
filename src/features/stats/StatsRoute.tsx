import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Spinner } from '@/ui';

// The charts library is the heaviest part of the app: load the page only when it is opened.
const StatsPage = lazy(() => import('./StatsPage'));

export function StatsRoute() {
  const { t } = useTranslation('stats');
  return (
    <Suspense
      fallback={
        <div className="grid place-items-center py-16">
          <Spinner label={t('loading')} />
        </div>
      }
    >
      <StatsPage />
    </Suspense>
  );
}
