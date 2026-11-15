import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { PATHS } from '@/app/routing';
import { useCategories, type Category } from '@/data';
import { SUGGESTION_THRESHOLD } from '@/domain/estimates';
import { useFormat } from '@/i18n/useFormat';
import {
  buttonClass,
  Card,
  EmptyState,
  Icon,
  Page,
  SegmentedControl,
  Spinner,
  type IconName,
} from '@/ui';
import {
  BarList,
  ChartCard,
  ClimbChart,
  ColumnChart,
  DataTable,
  GuessBars,
  type SeriesPoint,
} from './charts';
import {
  computeStats,
  computeWeeklyRecap,
  DAY_PARTS,
  type Stats,
  type StatsRange,
} from './compute';
import { useStatsInput } from './data';
import { WeeklyRecapCard } from './WeeklyRecap';

const RANGE_KEY = 'ql.stats.range';

function savedRange(): StatsRange {
  try {
    const v = localStorage.getItem(RANGE_KEY);
    return v === '30d' || v === 'all' ? v : '7d';
  } catch {
    return '7d';
  }
}

/** Stats and the weekly recap (plan section 13). Loaded on demand: charts are heavy. */
export default function StatsPage() {
  const { t } = useTranslation('stats');
  const input = useStatsInput();
  const [range, setRange] = useState<StatsRange>(savedRange);
  const stats = useMemo(() => (input ? computeStats(input, range) : null), [input, range]);
  const recap = useMemo(() => (input ? computeWeeklyRecap(input) : null), [input]);

  const choose = (r: StatsRange) => {
    setRange(r);
    try {
      localStorage.setItem(RANGE_KEY, r);
    } catch {
      /* fine: the choice just is not remembered */
    }
  };

  const hasAnything =
    !!input &&
    (input.ledger.some((e) => e.xp > 0) ||
      input.sessions.some((s) => s.kind === 'focus' && s.focused_ms > 0) ||
      input.steps.some((s) => s.done_at !== null));

  return (
    <Page title={t('title')} subtitle={t('subtitle')}>
      {!stats || !input ? (
        <div className="py-10">
          <Spinner label={t('loading')} />
        </div>
      ) : !hasAnything ? (
        <EmptyState
          icon="stats"
          title={t('empty.title')}
          action={
            <Link to={PATHS.today} className={buttonClass('primary')}>
              {t('empty.action')}
            </Link>
          }
        >
          {t('empty.body')}
        </EmptyState>
      ) : (
        <>
          {recap?.hasWins && <WeeklyRecapCard recap={recap} />}
          <SegmentedControl
            label={t('range.label')}
            value={range}
            onChange={choose}
            options={(['7d', '30d', 'all'] as const).map((r) => ({
              value: r,
              label: t(`range.${r}`),
            }))}
          />
          <StatsBody stats={stats} />
        </>
      )}
    </Page>
  );
}

function StatsBody({ stats }: { stats: Stats }) {
  const { t } = useTranslation('stats');
  const f = useFormat();
  const rangeText = t(`range_phrase.${stats.range}`);
  const dayLabel = (key: string) =>
    stats.unit === 'week' ? t('table.week') + ' ' + f.date(key, 'dayShort') : f.date(key, 'medium');
  const tick = (key: string) =>
    stats.range === '7d' ? f.date(key, 'weekdayShort') : f.date(key, 'dayShort');
  const minutes = (ms: number) => Math.round(ms / 60_000);

  const focus: SeriesPoint[] = stats.buckets.map((b) => ({
    key: b.start,
    value: minutes(b.focusMs),
  }));
  const steps: SeriesPoint[] = stats.buckets.map((b) => ({ key: b.start, value: b.steps }));
  const xp: SeriesPoint[] = stats.buckets.map((b) => ({ key: b.start, value: b.xpTotal }));
  const parts: SeriesPoint[] = DAY_PARTS.map((p) => ({ key: p, value: minutes(stats.byPart[p]) }));
  const dParts: SeriesPoint[] = DAY_PARTS.map((p) => ({
    key: p,
    value: stats.distractions.byPart[p],
  }));
  const dDays: SeriesPoint[] = stats.distractions.weekdays.map((wd, i) => ({
    key: String(wd),
    value: stats.distractions.byWeekday[i]!,
  }));
  const weekdayName = (wd: number) => {
    // 2026-03-01 was a Sunday: add the weekday number to get a date with that weekday.
    const day = `2026-03-0${wd + 1}`;
    return f.date(day, 'weekday');
  };
  const minutesText = (v: number) => f.duration(v * 60_000);
  const lastXp = stats.buckets.at(-1)?.xpTotal ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <section aria-label={t('tiles.label')} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon="timer" label={t('tiles.focus')} value={f.duration(stats.totals.focusMs)} />
        <Tile icon="check" label={t('tiles.steps')} value={f.number(stats.totals.steps)} />
        <Tile icon="star" label={t('tiles.quests')} value={f.number(stats.totals.quests)} />
        <Tile
          icon="flame"
          label={t('tiles.active_days')}
          value={f.number(stats.activeDays)}
          note={t('tiles.streak', { count: stats.streak, n: f.number(stats.streak) })}
        />
      </section>

      <ChartCard
        testId="chart-focus"
        title={t('focus.title')}
        summary={
          stats.totals.focusMs > 0
            ? `${t('focus.summary', { total: f.duration(stats.totals.focusMs), range: rangeText })}${
                stats.bestDay
                  ? ' ' + t('focus.best_day', { day: f.date(stats.bestDay, 'weekday') })
                  : ''
              }`
            : t('focus.empty')
        }
        table={
          <DataTable
            caption={t('focus.title')}
            headers={[stats.unit === 'week' ? t('table.week') : t('table.day'), t('table.minutes')]}
            rows={focus.map((p) => [dayLabel(p.key), f.number(p.value)])}
          />
        }
      >
        {stats.totals.focusMs > 0 && (
          <ColumnChart
            data={focus}
            tone="primary"
            labelOf={dayLabel}
            tickOf={tick}
            valueOf={minutesText}
          />
        )}
      </ChartCard>

      <ChartCard
        testId="chart-steps"
        title={t('steps.title')}
        summary={
          stats.totals.steps > 0
            ? t('steps.summary', {
                count: stats.totals.steps,
                n: f.number(stats.totals.steps),
                range: rangeText,
              }) +
              (stats.totals.quests > 0
                ? t('steps.quests', {
                    count: stats.totals.quests,
                    n: f.number(stats.totals.quests),
                  })
                : t('steps.quests_none'))
            : t('steps.empty')
        }
        table={
          <DataTable
            caption={t('steps.title')}
            headers={[stats.unit === 'week' ? t('table.week') : t('table.day'), t('table.steps')]}
            rows={steps.map((p) => [dayLabel(p.key), f.number(p.value)])}
          />
        }
      >
        {stats.totals.steps > 0 && (
          <ColumnChart
            data={steps}
            tone="accent"
            labelOf={dayLabel}
            tickOf={tick}
            valueOf={(v) => t('steps.value', { count: v, n: f.number(v) })}
          />
        )}
      </ChartCard>

      <ChartCard
        testId="chart-best-time"
        title={t('best_time.title')}
        summary={
          stats.bestPart
            ? t('best_time.summary', { part: t(`parts_phrase.${stats.bestPart}`) })
            : t('best_time.empty')
        }
        table={
          <DataTable
            caption={t('best_time.title')}
            headers={[t('table.part'), t('table.minutes')]}
            rows={parts.map((p) => [t(`parts.${p.key as 'early'}`), f.number(p.value)])}
          />
        }
      >
        {stats.bestPart && (
          <BarList
            data={parts}
            tone="primary"
            labelOf={(k) => t(`parts.${k as 'early'}`)}
            valueOf={minutesText}
          />
        )}
      </ChartCard>

      <ChartCard
        testId="chart-distractions"
        title={t('distractions.title')}
        summary={
          stats.distractions.total > 0 &&
          stats.distractions.topPart &&
          stats.distractions.topWeekday !== null
            ? `${t('distractions.summary_count', {
                count: stats.distractions.total,
                n: f.number(stats.distractions.total),
                range: rangeText,
              })} ${t('distractions.summary', {
                part: t(`parts_phrase.${stats.distractions.topPart}`),
                weekday: weekdayName(stats.distractions.topWeekday),
              })}`
            : t('distractions.empty', { range: rangeText })
        }
        table={
          stats.distractions.total > 0 && (
            <>
              <DataTable
                caption={t('distractions.by_part')}
                headers={[t('table.part'), t('table.count')]}
                rows={dParts.map((p) => [t(`parts.${p.key as 'early'}`), f.number(p.value)])}
              />
              <DataTable
                caption={t('distractions.by_weekday')}
                headers={[t('table.weekday'), t('table.count')]}
                rows={dDays.map((p) => [weekdayName(Number(p.key)), f.number(p.value)])}
              />
            </>
          )
        }
      >
        {stats.distractions.total > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <h3 className="mb-1 text-sm font-bold text-muted">{t('distractions.by_part')}</h3>
              <BarList
                data={dParts}
                tone="info"
                labelOf={(k) => t(`parts.${k as 'early'}`)}
                valueOf={(v) => f.number(v)}
              />
            </div>
            <div className="min-w-0">
              <h3 className="mb-1 text-sm font-bold text-muted">{t('distractions.by_weekday')}</h3>
              <BarList
                data={dDays}
                tone="info"
                labelOf={(k) => weekdayName(Number(k))}
                valueOf={(v) => f.number(v)}
              />
            </div>
          </div>
        )}
      </ChartCard>

      <Estimates stats={stats} />

      <ChartCard
        testId="chart-xp"
        title={t('xp.title')}
        summary={
          lastXp > 0
            ? t('xp.summary', {
                gained: f.number(stats.totals.xp),
                total: f.number(lastXp),
                range: rangeText,
              })
            : t('xp.empty')
        }
        table={
          <DataTable
            caption={t('xp.title')}
            headers={[stats.unit === 'week' ? t('table.week') : t('table.day'), t('table.xp')]}
            rows={xp.map((p) => [dayLabel(p.key), f.number(p.value)])}
          />
        }
      >
        {lastXp > 0 && (
          <ClimbChart
            data={xp}
            tone="xp"
            labelOf={dayLabel}
            tickOf={tick}
            valueOf={(v) => t('xp.value', { n: f.number(v) })}
          />
        )}
      </ChartCard>
    </div>
  );
}

function Tile({
  icon,
  label,
  value,
  note,
}: {
  icon: IconName;
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <Card padding="sm" className="flex min-w-0 flex-col gap-1">
      <p className="flex items-center gap-1.5 text-sm font-bold text-muted">
        <Icon name={icon} className="shrink-0" />
        <span className="min-w-0 break-words">{label}</span>
      </p>
      <p className="text-2xl font-extrabold text-text break-words">{value}</p>
      {note && <p className="text-xs text-muted">{note}</p>}
    </Card>
  );
}

function Estimates({ stats }: { stats: Stats }) {
  const { t } = useTranslation('stats');
  const { t: tq } = useTranslation('quests');
  const f = useFormat();
  const categories = useCategories();
  const { overall, byCategory } = stats.estimates.ratios;
  const ratioText = (r: number) => f.number(Math.round(r * 10) / 10, { maximumFractionDigits: 1 });
  const nameOf = (c: Category | undefined) => {
    if (!c) return t('estimates.category_none');
    if (c.name) return c.name;
    if (c.name_key === 'school' || c.name_key === 'home' || c.name_key === 'personal')
      return tq(`categories.defaults.${c.name_key}`);
    return t('estimates.category_none');
  };
  const recent = stats.estimates.recent;
  const summary = overall
    ? Math.abs(overall.ratio - 1) < SUGGESTION_THRESHOLD
      ? t('estimates.ratio_close')
      : t('estimates.ratio', { ratio: ratioText(overall.ratio) })
    : recent.length > 0
      ? t('estimates.ratio_none')
      : t('estimates.empty');
  const cats = Object.entries(byCategory);

  return (
    <ChartCard
      testId="chart-estimates"
      title={t('estimates.title')}
      summary={summary}
      decorative={false}
    >
      {(recent.length > 0 || cats.length > 0) && (
        <div className="flex flex-col gap-4">
          {cats.length > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-bold text-muted">{t('estimates.by_category')}</h3>
              <ul className="flex flex-col gap-1 text-sm">
                {cats.map(([id, r]) => (
                  <li key={id} className="flex flex-wrap justify-between gap-x-3">
                    <span className="font-bold text-text">
                      {nameOf(categories?.find((c) => c.id === id))}
                    </span>
                    <span className="text-muted">
                      {t('estimates.ratio_category', { ratio: ratioText(r.ratio) })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {recent.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-bold text-muted">{t('estimates.recent')}</h3>
              <GuessBars
                guessLabel={t('table.guess')}
                actualLabel={t('table.actual')}
                rows={recent.map((r) => ({
                  title: r.title,
                  guess: r.guessMinutes,
                  actual: r.actualMinutes,
                  guessText: f.duration(r.guessMinutes * 60_000),
                  actualText: f.duration(r.actualMinutes * 60_000),
                }))}
              />
            </div>
          )}
        </div>
      )}
    </ChartCard>
  );
}
