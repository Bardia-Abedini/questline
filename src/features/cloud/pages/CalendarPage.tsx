import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { db, focusBlocksRepo, useNow, useProfile, useToday } from '@/data';
import { addDays } from '@/domain/dates';
import { useFormat } from '@/i18n/useFormat';
import {
  Button,
  buttonClass,
  Card,
  Dialog,
  Icon,
  IconButton,
  Page,
  Section,
  Select,
  showToast,
  Spinner,
} from '@/ui';
import type { DayEvent } from '../../../../supabase/functions/_shared/calendar.ts';
import { zonedTime } from '../../../../supabase/functions/_shared/reminders.ts';
import {
  connectCalendar,
  fetchDayEvents,
  handleCalendarError,
  refreshCalendarStatus,
  useCalendar,
} from '../calendar/api';
import { freeGaps, type Span } from '../calendar/gaps';
import { useCloud } from '../store';

/** The day view shows free time between these local hours. */
const DAY_START = '08:00';
const DAY_END = '22:00';
const LENGTHS = [15, 25, 45, 60, 90];

function useDayEvents(day: string, timezone: string, connected: boolean) {
  const key = `${day}|${timezone}`;
  const [state, setState] = useState<{ key: string; events: DayEvent[]; failed: boolean }>({
    key: '',
    events: [],
    failed: false,
  });
  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    const from = new Date(zonedTime(day, '00:00', timezone)).toISOString();
    const to = new Date(zonedTime(addDays(day, 1), '00:00', timezone)).toISOString();
    fetchDayEvents(from, to)
      .then((events) => !cancelled && setState({ key, events, failed: false }))
      .catch((e) => {
        handleCalendarError(e);
        if (!cancelled) setState({ key, events: [], failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [day, timezone, connected, key]);
  const current = connected && state.key === key;
  return {
    events: current ? state.events : [],
    loading: connected && !current,
    failed: current && state.failed,
  };
}

export function CalendarPage() {
  const { t } = useTranslation('cloud');
  const { date, time, number } = useFormat();
  const today = useToday();
  const [day, setDay] = useState(today);
  const [params, setParams] = useSearchParams();
  const profile = useProfile();
  const timezone = profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const auth = useCloud((s) => s.auth);
  const connected = useCloud((s) => s.connected);
  const calendar = useCalendar();
  const google = useDayEvents(day, timezone, calendar.status === 'connected');
  const [planning, setPlanning] = useState<Span | null>(null);

  // Back from Google's consent screen.
  useEffect(() => {
    const result = params.get('calendar');
    if (!result) return;
    showToast({
      tone: result === 'connected' ? 'success' : 'warning',
      icon: 'cloud',
      title: t(
        `calendar.result_${result === 'connected' ? 'connected' : result === 'denied' ? 'denied' : 'error'}`,
      ),
    });
    setParams({}, { replace: true });
  }, [params, setParams, t]);

  useEffect(() => {
    if (connected) void refreshCalendarStatus();
  }, [connected]);

  const local = useLiveQuery(async () => {
    const from = zonedTime(day, '00:00', timezone);
    const to = zonedTime(addDays(day, 1), '00:00', timezone);
    const blocks = (await db.focus_blocks.toArray()).filter(
      (b) => !b.deleted_at && Date.parse(b.end_at) > from && Date.parse(b.start_at) < to,
    );
    const quests = (await db.quests.where('due_date').equals(day).toArray()).filter(
      (q) => !q.deleted_at && q.status !== 'archived',
    );
    const titles = new Map((await db.quests.toArray()).map((q) => [q.id, q.title]));
    return { blocks, quests, titles };
  }, [day, timezone]);

  const window: Span = {
    start: zonedTime(day, DAY_START, timezone),
    end: zonedTime(day, DAY_END, timezone),
  };
  const busy = useMemo<Span[]>(
    () => [
      ...google.events
        .filter((e) => !e.allDay)
        .map((e) => ({ start: Date.parse(e.start), end: Date.parse(e.end) })),
      ...(local?.blocks ?? []).map((b) => ({
        start: Date.parse(b.start_at),
        end: Date.parse(b.end_at),
      })),
    ],
    [google.events, local?.blocks],
  );
  const now = useNow();
  const gaps = freeGaps(busy, window).filter((g) => g.end > now);
  const range = (s: Span) => t('calendar.range', { from: time(s.start), to: time(s.end) });

  const timeline = [
    ...google.events.map((e) => ({
      key: `g:${e.id}`,
      start: e.allDay ? window.start - 1 : Date.parse(e.start),
      label: e.title || t('calendar.busy'),
      when: e.allDay
        ? t('calendar.all_day')
        : range({ start: Date.parse(e.start), end: Date.parse(e.end) }),
      icon: 'globe' as const,
      blockId: null as string | null,
    })),
    ...(local?.blocks ?? []).map((b) => ({
      key: `b:${b.id}`,
      start: Date.parse(b.start_at),
      label: (b.quest_id && local?.titles.get(b.quest_id)) || t('calendar.focus_block'),
      when: range({ start: Date.parse(b.start_at), end: Date.parse(b.end_at) }),
      icon: 'timer' as const,
      blockId: b.id,
    })),
  ].sort((a, b) => a.start - b.start);

  return (
    <Page title={t('calendar.title')} subtitle={t('calendar.subtitle')}>
      <ConnectionCard auth={auth} />

      <div className="flex items-center justify-between gap-2">
        <IconButton
          icon="chevron-back"
          variant="ghost"
          label={t('calendar.previous_day')}
          onClick={() => setDay(addDays(day, -1))}
        />
        <div className="min-w-0 text-center">
          <p className="font-bold text-text" data-testid="calendar-day">
            {date(day, 'long')}
          </p>
          {day !== today && (
            <button
              type="button"
              className="text-sm font-bold text-primary underline"
              onClick={() => setDay(today)}
            >
              {t('calendar.today')}
            </button>
          )}
        </div>
        <IconButton
          icon="chevron-forward"
          variant="ghost"
          label={t('calendar.next_day')}
          onClick={() => setDay(addDays(day, 1))}
        />
      </div>

      {(local?.quests.length ?? 0) > 0 && (
        <Section title={t('calendar.due_title')}>
          <ul className="flex flex-col gap-2">
            {local!.quests.map((q) => (
              <Card as="li" key={q.id} padding="sm" className="flex items-center gap-2">
                <Icon
                  name={q.status === 'done' ? 'check' : 'flame'}
                  className="shrink-0 text-primary"
                />
                <span className="min-w-0 flex-1 truncate">{q.title}</span>
                {q.due_time && (
                  <span className="shrink-0 text-sm text-muted">
                    {time(zonedTime(day, q.due_time, timezone))}
                  </span>
                )}
              </Card>
            ))}
          </ul>
        </Section>
      )}

      <Section title={t('calendar.schedule_title')}>
        {google.loading && <Spinner label={t('calendar.loading')} />}
        {google.failed && <p className="text-sm text-muted">{t('calendar.load_failed')}</p>}
        {timeline.length === 0 && !google.loading ? (
          <p className="text-muted">{t('calendar.nothing_planned')}</p>
        ) : (
          <ul className="flex flex-col gap-2" data-testid="calendar-timeline">
            {timeline.map((item) => (
              <Card
                as="li"
                key={item.key}
                padding="sm"
                tone={item.blockId ? 'highlight' : 'sunken'}
                className="flex items-center gap-3"
              >
                <Icon name={item.icon} className="shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-text">{item.label}</p>
                  <p className="text-sm text-muted">{item.when}</p>
                </div>
                {item.blockId && (
                  <IconButton
                    icon="trash"
                    variant="ghost"
                    size="sm"
                    label={t('calendar.remove_block', { title: item.label })}
                    onClick={() => void focusBlocksRepo.remove(item.blockId!)}
                  />
                )}
              </Card>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title={t('calendar.free_title')}
        description={t('calendar.free_hint', { from: time(window.start), to: time(window.end) })}
      >
        {gaps.length === 0 ? (
          <p className="text-muted">{t('calendar.no_gaps')}</p>
        ) : (
          <ul className="flex flex-col gap-2" data-testid="calendar-gaps">
            {gaps.map((g) => (
              <Card
                as="li"
                key={g.start}
                padding="sm"
                className="flex flex-wrap items-center gap-3"
              >
                <Icon name="sparkle" className="shrink-0 text-xp" />
                {/* Wide enough for the time range; the button wraps below on narrow screens. */}
                <div className="min-w-[10rem] flex-1">
                  <p className="font-bold text-text">{range(g)}</p>
                  <p className="text-sm text-muted">
                    {t('calendar.minutes_free', {
                      count: Math.round((g.end - g.start) / 60_000),
                      n: number(Math.round((g.end - g.start) / 60_000)),
                    })}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="soft"
                  icon="plus"
                  onClick={() =>
                    setPlanning({ start: Math.max(g.start, roundUp(now)), end: g.end })
                  }
                >
                  {t('calendar.plan_block')}
                </Button>
              </Card>
            ))}
          </ul>
        )}
      </Section>

      <PlanDialog gap={planning} onClose={() => setPlanning(null)} />
    </Page>
  );
}

const roundUp = (ms: number) => Math.ceil(ms / (5 * 60_000)) * 5 * 60_000;

function ConnectionCard({ auth }: { auth: string }) {
  const { t } = useTranslation('cloud');
  const calendar = useCalendar();
  const [busy, setBusy] = useState(false);
  if (calendar.status === 'connected') {
    return (
      <Card
        tone="sunken"
        padding="sm"
        className="flex items-center gap-2"
        data-testid="calendar-connected"
      >
        <Icon name="check" className="shrink-0 text-success" />
        <p className="min-w-0 text-sm text-muted">
          {t('calendar.connected_as', { email: calendar.email ?? '' })}
        </p>
      </Card>
    );
  }
  const key =
    auth !== 'signed_in'
      ? auth === 'unconfigured'
        ? 'unconfigured'
        : 'guest'
      : calendar.status === 'unconfigured'
        ? 'unconfigured'
        : calendar.status === 'disconnected'
          ? 'disconnected'
          : 'checking';
  return (
    <Card tone="sunken" className="flex items-start gap-3" data-testid="calendar-explainer">
      <Icon name="lantern" className="mt-1 shrink-0 text-primary" size={22} />
      <div className="min-w-0">
        <p className="font-bold text-text">{t(`calendar.explain_${key}`)}</p>
        <p className="text-sm text-muted">{t(`calendar.explain_${key}_hint`)}</p>
        {key === 'guest' && (
          <Link to="/account" className={`${buttonClass('soft', 'sm')} mt-2`}>
            {t('ai.go_to_account')}
          </Link>
        )}
        {key === 'disconnected' && (
          <Button
            size="sm"
            className="mt-2"
            icon="globe"
            loading={busy}
            onClick={() => {
              setBusy(true);
              void connectCalendar().catch(() => {
                setBusy(false);
                showToast({ tone: 'warning', icon: 'alert', title: t('calendar.result_error') });
              });
            }}
          >
            {t('calendar.connect')}
          </Button>
        )}
      </div>
    </Card>
  );
}

function PlanDialog({ gap, onClose }: { gap: Span | null; onClose: () => void }) {
  const { t } = useTranslation('cloud');
  const { time } = useFormat();
  const quests = useLiveQuery(
    async () =>
      (await db.quests.toArray())
        .filter((q) => !q.deleted_at && (q.status === 'active' || q.status === 'backlog'))
        .sort((a, b) =>
          a.status === b.status ? a.title.localeCompare(b.title) : a.status === 'active' ? -1 : 1,
        ),
    [],
  );
  const [questId, setQuestId] = useState('');
  const [minutes, setMinutes] = useState(25);
  if (!gap) return null;
  const max = Math.floor((gap.end - gap.start) / 60_000);
  const lengths = LENGTHS.filter((m) => m <= max);
  const length = Math.min(minutes, max);
  const chosen = questId || quests?.[0]?.id || '';

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('calendar.plan_title')}
      description={t('calendar.plan_body', { from: time(gap.start) })}
      footer={
        <div className="flex w-full flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t('data.cancel')}
          </Button>
          <Button
            icon="check"
            disabled={!chosen}
            onClick={() => {
              void focusBlocksRepo
                .create({
                  quest_id: chosen,
                  step_id: null,
                  start_at: new Date(gap.start).toISOString(),
                  end_at: new Date(gap.start + length * 60_000).toISOString(),
                })
                .then(() => {
                  showToast({ tone: 'success', icon: 'timer', title: t('calendar.planned') });
                  onClose();
                });
            }}
          >
            {t('calendar.plan_save')}
          </Button>
        </div>
      }
    >
      {quests && quests.length === 0 ? (
        <p className="text-muted">{t('calendar.no_quests')}</p>
      ) : (
        <div className="flex flex-col gap-4">
          <Select
            label={t('calendar.quest')}
            value={chosen}
            onChange={(e) => setQuestId(e.target.value)}
            options={(quests ?? []).map((q) => ({ value: q.id, label: q.title }))}
          />
          <Select
            label={t('calendar.length')}
            value={String(length)}
            onChange={(e) => setMinutes(Number(e.target.value))}
            options={(lengths.length ? lengths : [max]).map((m) => ({
              value: String(m),
              label: t('calendar.minutes', { count: m }),
            }))}
          />
        </div>
      )}
    </Dialog>
  );
}
