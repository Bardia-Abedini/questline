import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { bossHealth, isBossEligible } from '@/domain/quests';
import { BOSS_FINISH_MULTIPLIER } from '@/domain/rewards';
import { useNow, useSettings } from '@/data';
import { useFormat } from '@/i18n/useFormat';
import {
  Button,
  buttonClass,
  Card,
  EmptyState,
  Icon,
  Page,
  ProgressBar,
  Section,
  showToast,
  Spinner,
} from '@/ui';
import {
  useCategoryMap,
  useQuestWithSteps,
  useRecurrenceRule,
  useStartedQuestIds,
  useTagMap,
} from '../hooks';
import {
  archiveQuest,
  deactivateQuest,
  deleteQuest,
  restoreQuest,
  saveAsTemplate,
  turnIntoBoss,
  undoDeleteQuest,
} from '../model/actions';
import { questActualMs, questGuessMinutes } from '../model/estimates';
import { stepProgress } from '../components/questUtils';
import { QuestIcon } from '../components/QuestIcon';
import { QuestMeta } from '../components/QuestMeta';
import { StepChecklist } from '../components/StepChecklist';
import { useStartQuest } from '../components/useStartQuest';

export function QuestDetailPage() {
  const { t } = useTranslation('quests');
  const format = useFormat();
  const navigate = useNavigate();
  const { questId } = useParams();
  const item = useQuestWithSteps(questId);
  const categories = useCategoryMap();
  const tags = useTagMap();
  const rule = useRecurrenceRule(item?.quest.recurrence_rule_id);
  const settings = useSettings();
  const now = useNow();
  const started = useStartedQuestIds();
  const { start, sheet } = useStartQuest();

  if (item === undefined)
    return (
      <Page title={t('detail.loading')} hideTitle>
        <Spinner label={t('loading')} />
      </Page>
    );
  if (item === null)
    return (
      <Page title={t('detail.missing_title')} hideTitle>
        <EmptyState
          icon="search"
          title={t('detail.missing_title')}
          action={
            <Link to="/quests" className={buttonClass('secondary')}>
              {t('detail.back_to_quests')}
            </Link>
          }
        >
          {t('detail.missing_body')}
        </EmptyState>
      </Page>
    );

  const { quest, steps } = item;
  const { done, total, next } = stepProgress(steps);
  const open = quest.status === 'active' || quest.status === 'backlog' || quest.status === 'inbox';
  const progressText = t('progress.steps', {
    done: format.number(done),
    total: format.number(total),
    count: total,
  });
  const health = bossHealth(total, done);
  const eligible = isBossEligible(quest, now);
  const guess = questGuessMinutes(quest, steps);
  const actual = questActualMs(steps);

  const statusLine = {
    active: t('status.active'),
    backlog: t('status.backlog'),
    inbox: t('status.inbox'),
    done: quest.completed_at
      ? t('status.done_on', { date: format.date(Date.parse(quest.completed_at), 'medium') })
      : t('status.done'),
    archived: t('status.archived'),
  }[quest.status];

  const onDelete = async () => {
    await deleteQuest(quest.id);
    navigate('/quests', { replace: true });
    showToast({
      title: t('toast.deleted', { title: quest.title }),
      icon: 'trash',
      action: { label: t('actions.undo'), onClick: () => void undoDeleteQuest(quest.id) },
    });
  };

  return (
    <Page
      title={quest.title}
      subtitle={statusLine}
      actions={
        <Link
          to={`/quests/${quest.id}/edit${quest.status === 'inbox' ? '?sort=1' : ''}`}
          className={buttonClass('secondary', 'sm')}
        >
          <Icon name="edit" />
          {quest.status === 'inbox' ? t('inbox.sort') : t('actions.edit')}
        </Link>
      }
    >
      <QuestMeta quest={quest} categories={categories} tags={tags} showTags />

      {open && next && (
        <Card tone="highlight" className="flex flex-col gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-muted">{t('detail.next_step')}</p>
            <p className="text-lg font-semibold break-words">{next.title}</p>
          </div>
          <Button
            size="lg"
            icon="play"
            fullWidth
            className="sm:w-auto sm:self-start"
            onClick={() => start(quest)}
          >
            {done > 0 || started?.has(quest.id) ? t('actions.continue') : t('actions.start')}
          </Button>
          {total > 1 && (
            <ProgressBar
              value={done}
              max={total}
              size="sm"
              tone="accent"
              label={t('progress.label', { title: quest.title })}
              valueText={progressText}
            >
              <span className="text-sm text-muted">{progressText}</span>
            </ProgressBar>
          )}
        </Card>
      )}

      {quest.is_boss && (
        <Card tone="default" className="flex flex-col gap-2" aria-labelledby="boss-title">
          <h2 id="boss-title" className="flex items-center gap-2 text-lg font-semibold">
            <Icon name="sword" className="text-primary" />
            {t('boss.title')}
          </h2>
          <ProgressBar
            value={health.current}
            max={health.max}
            size="md"
            tone="primary"
            label={t('boss.health')}
            valueText={t('boss.health_value', {
              current: format.number(health.current),
              max: format.number(health.max),
            })}
          >
            <span className="text-sm text-muted">
              {health.current === 0
                ? t('boss.defeated')
                : t('boss.health_value', {
                    current: format.number(health.current),
                    max: format.number(health.max),
                  })}
            </span>
          </ProgressBar>
        </Card>
      )}

      {eligible && (
        <Card tone="sunken" className="flex flex-col gap-2">
          <p className="flex items-start gap-2">
            <Icon name="sword" className="mt-0.5 shrink-0 text-primary" />
            <span>
              {t(quest.difficulty === 'S' ? 'boss.offer_rank' : 'boss.offer_waiting', {
                bonus: format.percent(BOSS_FINISH_MULTIPLIER - 1),
              })}
            </span>
          </p>
          <div>
            <Button
              variant="soft"
              size="sm"
              icon="sword"
              onClick={async () => {
                if (await turnIntoBoss(quest.id))
                  showToast({ title: t('boss.became'), tone: 'success', icon: 'sword' });
              }}
            >
              {t('boss.turn_into')}
            </Button>
          </div>
        </Card>
      )}

      {quest.notes && <p className="whitespace-pre-wrap break-words text-text">{quest.notes}</p>}

      {quest.status === 'done' && (guess || actual > 0) && (
        <Card tone="sunken" padding="sm">
          <p className="flex items-center gap-2 text-sm">
            <Icon name="timer" className="text-muted" />
            {guess && actual > 0
              ? t('estimate.guess_vs_actual', {
                  guess: format.duration(guess * 60_000),
                  actual: format.duration(actual),
                })
              : guess
                ? t('estimate.guess_only', { guess: format.duration(guess * 60_000) })
                : t('estimate.actual_only', { actual: format.duration(actual) })}
          </p>
        </Card>
      )}

      {rule && rule.active && (
        <p className="flex items-center gap-2 text-sm text-muted">
          <QuestIcon name="repeat" />
          {t(`recurrence.summary_${rule.kind}`, {
            count: rule.interval,
            n: format.number(rule.interval),
          })}
        </p>
      )}

      <Section title={t('detail.steps')}>
        <StepChecklist quest={quest} steps={steps} />
      </Section>

      <Section title={t('detail.more')}>
        <div className="flex flex-wrap gap-2">
          {quest.status === 'active' && (
            <Button
              variant="secondary"
              size="sm"
              icon="quests"
              onClick={() => deactivateQuest(quest.id)}
            >
              {t('actions.to_backlog')}
            </Button>
          )}
          {(quest.status === 'backlog' || quest.status === 'inbox') && (
            <Button
              variant="secondary"
              size="sm"
              icon="today"
              onClick={() => start(quest, { focus: false })}
            >
              {t('actions.activate')}
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              await saveAsTemplate(quest.id);
              showToast({
                title: t('toast.template_saved', { title: quest.title }),
                tone: 'success',
                icon: 'check',
                action: {
                  label: t('templates.view'),
                  onClick: () => navigate('/quests/templates'),
                },
              });
            }}
          >
            <QuestIcon name="template" />
            {t('actions.save_template')}
          </Button>
          {quest.status === 'archived' ? (
            <Button
              variant="secondary"
              size="sm"
              icon="refresh"
              onClick={() => restoreQuest(quest.id)}
            >
              {t('actions.restore')}
            </Button>
          ) : (
            quest.status !== 'done' && (
              <Button
                variant="secondary"
                size="sm"
                icon="archive"
                onClick={async () => {
                  await archiveQuest(quest.id);
                  showToast({
                    title: t('toast.archived', { title: quest.title }),
                    icon: 'archive',
                  });
                }}
              >
                {t('actions.archive')}
              </Button>
            )
          )}
          <Button variant="danger" size="sm" icon="trash" onClick={onDelete}>
            {t('actions.delete')}
          </Button>
        </div>
        {settings && quest.status === 'backlog' && (
          <p className="text-sm text-muted">
            {t('detail.limit_note', { limit: format.number(settings.active_limit) })}
          </p>
        )}
      </Section>
      {sheet}
    </Page>
  );
}
