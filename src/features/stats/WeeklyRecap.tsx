import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { PATHS } from '@/app/routing';
import { localMeta, useSettings, useToday } from '@/data';
import { useFormat } from '@/i18n/useFormat';
import { buttonClass, Card, Icon, IconButton } from '@/ui';
import { computeWeeklyRecap, recapOfferOpen, type WeeklyRecap } from './compute';
import { useStatsInput } from './data';

const DISMISSED_KEY = 'weekly_recap_dismissed';

/** The lines of a recap: wins only, and only the ones that happened. */
function useRecapLines(recap: WeeklyRecap): string[] {
  const { t } = useTranslation('stats');
  const f = useFormat();
  const lines: string[] = [];
  if (recap.focusMs > 0) lines.push(t('recap.focus', { time: f.duration(recap.focusMs) }));
  if (recap.steps > 0)
    lines.push(t('recap.steps', { count: recap.steps, n: f.number(recap.steps) }));
  if (recap.quests > 0)
    lines.push(t('recap.quests', { count: recap.quests, n: f.number(recap.quests) }));
  if (recap.bestDay) lines.push(t('recap.best_day', { day: f.date(recap.bestDay, 'weekday') }));
  if (recap.levels.length === 1)
    lines.push(t('recap.level', { count: 1, level: f.number(recap.levels[0]!) }));
  else if (recap.levels.length > 1)
    lines.push(
      t('recap.level', {
        count: recap.levels.length,
        from: f.number(recap.levels[0]!),
        to: f.number(recap.levels.at(-1)!),
      }),
    );
  if (recap.badges > 0)
    lines.push(t('recap.badges', { count: recap.badges, n: f.number(recap.badges) }));
  if (recap.estimatesImproved) lines.push(t('recap.estimates'));
  return lines;
}

/** The recap card. `onDismiss` adds a close button (Today); the Stats page shows it plainly. */
export function WeeklyRecapCard({
  recap,
  onDismiss,
}: {
  recap: WeeklyRecap;
  onDismiss?: () => void;
}) {
  const { t } = useTranslation('stats');
  const f = useFormat();
  const lines = useRecapLines(recap);
  return (
    <Card
      as="section"
      tone="gold"
      aria-labelledby="weekly-recap-title"
      className="flex flex-col gap-3"
      data-testid="weekly-recap"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-gold">
          <Icon name="star" filled size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="weekly-recap-title" className="text-lg font-semibold text-text">
            {t('recap.title')}
          </h2>
          <p className="text-sm text-muted">
            {t('recap.range', {
              from: f.date(recap.weekStart, 'dayMonth'),
              to: f.date(recap.weekEnd, 'dayMonth'),
            })}
          </p>
        </div>
        {onDismiss && (
          <IconButton icon="close" label={t('recap.dismiss')} onClick={onDismiss} size="md" />
        )}
      </div>
      <ul className="flex flex-col gap-1.5">
        {lines.map((line) => (
          <li key={line} className="flex items-start gap-2 text-text">
            <Icon name="check" className="mt-1 shrink-0 text-success" />
            <span className="min-w-0">{line}</span>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted">{t('recap.cheer')}</p>
      {onDismiss && (
        <div>
          <Link to={PATHS.stats} className={buttonClass('secondary', 'sm')}>
            {t('recap.see_stats')}
          </Link>
        </div>
      )}
    </Card>
  );
}

/**
 * Offered once on Today during the first days of a new week, when last week had a win.
 * Dismissing it (on this device) hides it for that week for good.
 */
export function WeeklyRecapOffer() {
  const today = useToday();
  const settings = useSettings();
  if (!settings || !recapOfferOpen(today, settings.week_starts_on)) return null;
  return <RecapOffer />;
}

function RecapOffer() {
  const input = useStatsInput();
  const dismissed = useLiveQuery(
    async () => (await localMeta.get<string>(DISMISSED_KEY)) ?? null,
    [],
  );
  if (!input || dismissed === undefined) return null;
  const recap = computeWeeklyRecap(input);
  if (!recap.hasWins || dismissed === recap.weekStart) return null;
  return (
    <WeeklyRecapCard
      recap={recap}
      onDismiss={() => void localMeta.set(DISMISSED_KEY, recap.weekStart)}
    />
  );
}
