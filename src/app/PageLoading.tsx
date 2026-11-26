import { useTranslation } from 'react-i18next';
import { Spinner } from '@/ui';

/** Shown for a moment while a page's code loads. */
export function PageLoading() {
  const { t } = useTranslation('common');
  return (
    <div className="grid min-h-40 place-items-center py-16">
      <Spinner label={t('loading')} />
    </div>
  );
}
