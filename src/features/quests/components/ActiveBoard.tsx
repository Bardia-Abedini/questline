import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { focusPath } from '@/app/routing';
import { useSettings } from '@/data';
import { useFormat } from '@/i18n/useFormat';
import { Button, buttonClass, Card, EmptyState, Icon, ProgressBar } from '@/ui';
import { useCategoryMap, useQuestList, useStatusCounts, type QuestWithSteps } from '../hooks';
import { questPath, stepProgress } from './questUtils';
import { QuestIcon } from './QuestIcon';
import { QuestMeta } from './QuestMeta';

/**
 * Active Quests on the Today board (plan section 2), in the domain order. The top quest
 * gets a big Continue button: opening the app and tapping it lands in focus on the right
 * step. Every other quest has its own Start button.
 */
export function ActiveBoard() {
  const { t } = useTranslation('quests');
  const { number } = useFormat();
  const active = useQuestList('active');
  const counts = useStatusCounts();
  const settings = useSettings();
  const categories = useCategoryMap();
  if (!active || !settings) return null;

  const limit = settings.active_limit;
  return (
    <section aria-labelledby="active-quests" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="active-quests" className="text-xl font-semibold">
          {t('board.title')}
        </h2>
        <span className="text-sm text-muted">
          {t('board.count', { active: number(active.length), limit: number(limit) })}
        </span>
      </div>

      {active.length === 0 ? (
        <EmptyState
          icon="lantern"
          title={t('board.empty_title')}
          action={
            <>
              <Link to="/quests/new?from=today" className={buttonClass('primary')}>
                <QuestIcon name="plus" />
                {t('actions.new_quest')}
              </Link>
              {counts && counts.backlog > 0 && (
                <Link to="/quests" className={buttonClass('secondary')}>
                  {t('board.pick_backlog')}
                </Link>
              )}
            </>
          }
        >
          {t('board.empty_body')}
        </EmptyState>
      ) : (
        <ol className="flex flex-col gap-3">
          {active.map((item, i) => (
            <ActiveCard key={item.quest.id} item={item} top={i === 0} categories={categories} />
          ))}
        </ol>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {active.length > 0 && (
          <Link to="/quests/new?from=today" className={buttonClass('secondary', 'sm')}>
            <QuestIcon name="plus" />
            {t('actions.new_quest')}
          </Link>
        )}
        <Link to="/brain-dump" className={buttonClass('ghost', 'sm')}>
          <Icon name="sparkle" />
          {t('board.brain_dump')}
        </Link>
        <Link to="/calendar" className={buttonClass('ghost', 'sm')}>
          <QuestIcon name="calendar" />
          {t('board.calendar')}
        </Link>
        {counts && counts.inbox > 0 && (
          <Link to="/quests?tab=inbox" className={buttonClass('ghost', 'sm')}>
            <Icon name="inbox" />
            {t('board.inbox', { count: counts.inbox, n: number(counts.inbox) })}
          </Link>
        )}
      </div>
    </section>
  );
}

function ActiveCard({
  item,
  top,
  categories,
}: {
  item: QuestWithSteps;
  top: boolean;
  categories: ReturnType<typeof useCategoryMap>;
}) {
  const { t } = useTranslation('quests');
  const format = useFormat();
  const navigate = useNavigate();
  const { quest, steps } = item;
  const { done, total, next } = stepProgress(steps);
  const progressText = t('progress.steps', {
    done: format.number(done),
    total: format.number(total),
    count: total,
  });
  const go = () => navigate(next ? focusPath({ stepId: next.id }) : questPath(quest.id));
  const label = top ? t('actions.continue') : t('actions.start');

  return (
    <Card
      as="li"
      tone={top ? 'highlight' : 'default'}
      padding={top ? 'md' : 'sm'}
      className="flex flex-col gap-3"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {top && <p className="text-sm font-bold text-primary">{t('board.up_next')}</p>}
          <Link
            to={questPath(quest.id)}
            className={
              top
                ? 'block text-xl font-semibold break-words text-text hover:underline'
                : 'block font-bold break-words text-text hover:underline'
            }
          >
            {quest.title}
          </Link>
          <QuestMeta quest={quest} categories={categories} className="mt-1.5" />
        </div>
        {!top && (
          <Button size="sm" variant="soft" icon="play" onClick={go} className="shrink-0">
            {label}
            <span className="ql-visually-hidden">: {quest.title}</span>
          </Button>
        )}
      </div>
      {next && !(total === 1 && next.title === quest.title && !next.guess_minutes) && (
        <p className="flex min-w-0 items-start gap-2 text-sm text-muted">
          <QuestIcon name="steps" className="mt-0.5" />
          <span className="min-w-0 break-words">
            {t('board.next_step', { step: next.title })}
            {next.guess_minutes ? ` · ${format.duration(next.guess_minutes * 60_000)}` : ''}
          </span>
        </p>
      )}
      {total > 1 && (
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
      {top && (
        <Button size="lg" icon="play" fullWidth onClick={go} className="sm:w-auto sm:self-start">
          {label}
          <span className="ql-visually-hidden">: {quest.title}</span>
        </Button>
      )}
    </Card>
  );
}
