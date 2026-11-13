import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { db, type FocusSession } from '@/data';
import { toLocalDate } from '@/domain/dates';
import { useFormat } from '@/i18n/useFormat';
import { Button, Card, Chip, EmptyState, Page, type ChipTone } from '@/ui';
import { groupByDay } from './logic/machine';

const PAGE = 60;

const REASON_TONE: Record<string, ChipTone> = {
  step_done: 'success',
  timer_done: 'accent',
  ended_while_away: 'info',
  stopped: 'neutral',
  abandoned: 'neutral',
};

/** Every focus session, grouped by day: quest, step, start-end, focused, away, distractions. */
export function HistoryPage() {
  const { t } = useTranslation('focus');
  const format = useFormat();
  const [limit, setLimit] = useState(PAGE);
  const data = useLiveQuery(async () => {
    const rows = (await db.focus_sessions.orderBy('started_at').reverse().toArray()).filter(
      (s) => s.deleted_at === null && s.kind === 'focus' && s.ended_at !== null,
    );
    const shown = rows.slice(0, limit);
    const stepIds = [...new Set(shown.map((s) => s.step_id).filter((x): x is string => !!x))];
    const questIds = [...new Set(shown.map((s) => s.quest_id).filter((x): x is string => !!x))];
    const [steps, quests] = await Promise.all([
      db.steps.bulkGet(stepIds),
      db.quests.bulkGet(questIds),
    ]);
    return {
      total: rows.length,
      shown,
      stepTitle: new Map(steps.filter((s) => !!s).map((s) => [s!.id, s!.title])),
      questTitle: new Map(quests.filter((q) => !!q).map((q) => [q!.id, q!.title])),
    };
  }, [limit]);

  const groups = data ? groupByDay(data.shown, (iso) => toLocalDate(Date.parse(iso))) : [];

  return (
    <Page title={t('history.title')} subtitle={t('history.subtitle')}>
      {data && data.total === 0 && (
        <EmptyState icon="timer" title={t('history.empty_title')}>
          {t('history.empty_body')}
        </EmptyState>
      )}
      {groups.map((g) => {
        const total = g.items.reduce((sum, s) => sum + s.focused_ms, 0);
        return (
          <section
            key={g.day}
            className="flex flex-col gap-2"
            aria-label={format.date(g.day, 'long')}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <h2 className="text-lg font-semibold text-text">{format.date(g.day, 'long')}</h2>
              <span className="text-sm text-muted">
                {t('history.day_total', { time: format.duration(total) })}
              </span>
            </div>
            <ul className="flex flex-col gap-2">
              {g.items.map((s) => (
                <SessionItem
                  key={s.id}
                  session={s}
                  stepTitle={(s.step_id && data?.stepTitle.get(s.step_id)) || t('history.untitled')}
                  questTitle={(s.quest_id && data?.questTitle.get(s.quest_id)) || null}
                />
              ))}
            </ul>
          </section>
        );
      })}
      {data && data.total > data.shown.length && (
        <Button
          variant="secondary"
          onClick={() => setLimit((n) => n + PAGE)}
          className="self-center"
        >
          {t('history.more')}
        </Button>
      )}
    </Page>
  );
}

function SessionItem({
  session: s,
  stepTitle,
  questTitle,
}: {
  session: FocusSession;
  stepTitle: string;
  questTitle: string | null;
}) {
  const { t } = useTranslation('focus');
  const format = useFormat();
  const reason = s.end_reason ?? 'stopped';
  return (
    <Card as="li" padding="sm" data-testid="history-item">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-bold break-words text-text">{stepTitle}</p>
          {questTitle && <p className="truncate text-sm text-muted">{questTitle}</p>}
        </div>
        <Chip size="sm" tone={REASON_TONE[reason] ?? 'neutral'}>
          {t(`history.reason.${reason}`)}
        </Chip>
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
        <span>
          {t('history.range', {
            start: format.time(Date.parse(s.started_at)),
            end: format.time(Date.parse(s.ended_at!)),
          })}
        </span>
        <span className="font-bold text-text">
          {t('history.focused', { time: format.duration(s.focused_ms) })}
        </span>
        {s.away_ms > 0 && <span>{t('history.away', { time: format.duration(s.away_ms) })}</span>}
        {s.distractions.length > 0 && (
          <span>
            {t('history.distractions', {
              count: s.distractions.length,
              value: format.number(s.distractions.length),
            })}
          </span>
        )}
      </p>
    </Card>
  );
}
