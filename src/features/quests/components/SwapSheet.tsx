import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings, type Uuid } from '@/data';
import { useFormat } from '@/i18n/useFormat';
import { Button, Icon, Sheet } from '@/ui';
import { useQuestList } from '../hooks';

export interface Pending {
  questId: Uuid;
  title: string;
  focus: boolean;
}

/** One tap sends an active quest back to the backlog (progress kept) and swaps the new one in. */
export function SwapSheet({
  pending,
  onClose,
  onSwap,
}: {
  pending: Pending | null;
  onClose: () => void;
  onSwap: (outId: Uuid) => Promise<void>;
}) {
  const { t } = useTranslation('quests');
  const { number } = useFormat();
  const settings = useSettings();
  const active = useQuestList('active');
  const [busy, setBusy] = useState<Uuid | null>(null);

  return (
    <Sheet
      open={!!pending}
      onClose={onClose}
      title={t('swap.title')}
      description={t('swap.body', {
        limit: number(settings?.active_limit ?? 3),
        title: pending?.title ?? '',
      })}
      footer={
        <Button variant="ghost" onClick={onClose}>
          {t('actions.cancel')}
        </Button>
      }
    >
      <ul className="flex flex-col gap-2">
        {(active ?? []).map(({ quest, steps }) => {
          const done = steps.filter((s) => s.done_at !== null).length;
          return (
            <li key={quest.id}>
              <button
                type="button"
                disabled={busy !== null}
                aria-label={t('swap.swap_for', { title: quest.title })}
                onClick={async () => {
                  setBusy(quest.id);
                  try {
                    await onSwap(quest.id);
                  } finally {
                    setBusy(null);
                  }
                }}
                className="flex min-h-14 w-full items-center gap-3 rounded-lg border border-border bg-surface-2 px-4 py-3 text-start transition-colors hover:border-primary/50 hover:bg-primary-soft disabled:opacity-60"
              >
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 block font-bold break-words text-text">
                    {quest.title}
                  </span>
                  {steps.length > 1 && (
                    <span className="block text-sm text-muted">
                      {t('progress.steps', {
                        done: number(done),
                        total: number(steps.length),
                        count: steps.length,
                      })}
                    </span>
                  )}
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-primary">
                  <Icon name="archive" size="1.1em" />
                  {t('swap.rest')}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
