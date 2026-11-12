import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { Category, Uuid } from '@/data';
import { useFormat } from '@/i18n/useFormat';
import { Card, ProgressBar } from '@/ui';
import type { QuestWithSteps } from '../hooks';
import { QuestMeta } from './QuestMeta';

export function questPath(id: Uuid): string {
  return `/quests/${id}`;
}

export function stepProgress(steps: QuestWithSteps['steps']) {
  const done = steps.filter((s) => s.done_at !== null).length;
  return { done, total: steps.length, next: steps.find((s) => s.done_at === null) ?? null };
}

/** A quest in a list: title (opens the quest), calm meta chips, progress, and actions. */
export function QuestCard({
  item,
  categories,
  actions,
  extra,
}: {
  item: QuestWithSteps;
  categories: ReadonlyMap<Uuid, Category>;
  actions?: ReactNode;
  extra?: ReactNode;
}) {
  const { t } = useTranslation('quests');
  const { number } = useFormat();
  const { quest, steps } = item;
  const { done, total } = stepProgress(steps);
  const progressText = t('progress.steps', {
    done: number(done),
    total: number(total),
    count: total,
  });
  return (
    <Card as="li" padding="sm" className="flex flex-col gap-2 sm:p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <Link
            to={questPath(quest.id)}
            className="block font-bold break-words text-text hover:text-primary hover:underline"
          >
            {quest.title}
          </Link>
          <QuestMeta quest={quest} categories={categories} className="mt-1.5" />
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </div>
      {total > 1 && quest.status !== 'done' && (
        <ProgressBar
          value={done}
          max={total}
          size="xs"
          tone="accent"
          label={t('progress.label', { title: quest.title })}
          valueText={progressText}
        >
          <span className="text-xs text-muted">{progressText}</span>
        </ProgressBar>
      )}
      {extra}
    </Card>
  );
}
