import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonClass, EmptyState } from '@/ui';
import { PATHS } from './routing';

export function NotFoundPage() {
  const { t } = useTranslation('common');
  return (
    <div className="py-10">
      <EmptyState
        icon="leaf"
        title={t('not_found.title')}
        action={
          <Link to={PATHS.today} className={buttonClass('primary')}>
            {t('not_found.action')}
          </Link>
        }
      >
        {t('not_found.body')}
      </EmptyState>
    </div>
  );
}
