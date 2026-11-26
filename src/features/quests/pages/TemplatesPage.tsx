import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useTemplates } from '@/data';
import { useFormat } from '@/i18n/useFormat';
import { buttonClass, Card, EmptyState, IconButton, Page, showToast } from '@/ui';
import { deleteTemplate } from '../model/actions';

/** Saved templates: start a new quest from one, or delete it. */
export function TemplatesPage() {
  const { t } = useTranslation('quests');
  const { number } = useFormat();
  const templates = useTemplates();
  const sorted = (templates ?? []).slice().sort((a, b) => a.title.localeCompare(b.title));

  return (
    <Page title={t('templates.title')} subtitle={t('templates.subtitle')}>
      {templates && sorted.length === 0 ? (
        <EmptyState icon="sparkle" title={t('templates.empty_title')}>
          {t('templates.empty_body')}
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((tpl) => (
            <Card as="li" key={tpl.id} padding="sm" className="flex items-center gap-3 sm:p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{tpl.title}</p>
                <p className="text-sm text-muted">
                  {t('templates.steps', { count: tpl.steps.length, n: number(tpl.steps.length) })}
                </p>
              </div>
              <Link
                to={`/quests/new?template=${tpl.id}`}
                className={buttonClass('soft', 'sm')}
                aria-label={t('templates.use_for', { title: tpl.title })}
              >
                {t('templates.use')}
              </Link>
              <IconButton
                icon="trash"
                size="sm"
                label={t('templates.delete_for', { title: tpl.title })}
                onClick={async () => {
                  await deleteTemplate(tpl.id);
                  showToast({ title: t('templates.deleted', { title: tpl.title }), icon: 'trash' });
                }}
              />
            </Card>
          ))}
        </ul>
      )}
    </Page>
  );
}
