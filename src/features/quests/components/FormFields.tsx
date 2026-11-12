import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { BASE_REWARDS } from '@/domain/rewards';
import { ratioFor, suggestAdjustedGuess, type EstimateRatios } from '@/domain/estimates';
import { localDateTimeToMs } from '@/domain/dates';
import { DIFFICULTIES, PRIORITIES, type Difficulty, type Priority } from '@/domain/types';
import { useCategories, useTags, type Uuid } from '@/data';
import { useFormat } from '@/i18n/useFormat';
import {
  Button,
  Card,
  controlClass,
  cx,
  Icon,
  Input,
  SegmentedControl,
  Select,
  ToggleChip,
} from '@/ui';
import { ensureTag } from '../model/actions';
import { parseMinutes, type RecurrenceDraft } from '../model/draft';
import { toggleIn } from '../model/filters';
import { useCategoryName } from './QuestMeta';

export function PriorityField({
  value,
  onChange,
}: {
  value: Priority;
  onChange: (p: Priority) => void;
}) {
  const { t } = useTranslation('quests');
  return (
    <SegmentedControl
      label={t('form.priority')}
      showLabel
      value={value}
      onChange={onChange}
      options={PRIORITIES.map((p) => ({ value: p, label: t(`priority.${p}`) }))}
    />
  );
}

export function DifficultyField({
  value,
  onChange,
}: {
  value: Difficulty;
  onChange: (d: Difficulty) => void;
}) {
  const { t } = useTranslation('quests');
  const { number } = useFormat();
  const reward = BASE_REWARDS[value];
  return (
    <div className="flex flex-col gap-1.5">
      <SegmentedControl
        label={t('form.difficulty')}
        showLabel
        value={value}
        onChange={onChange}
        options={DIFFICULTIES.map((d) => ({ value: d, label: d }))}
      />
      <p className="text-sm text-muted">
        {t('form.difficulty_hint', {
          rank: value,
          xp: number(reward.xp),
          gold: number(reward.gold),
        })}
      </p>
    </div>
  );
}

/** "You usually take about 1.8x; use 45 min instead?" (plan section 8). */
export function EstimateHint({
  guessMinutes,
  categoryId,
  ratios,
  onUse,
}: {
  guessMinutes: number | null;
  categoryId: Uuid | null;
  ratios: EstimateRatios | undefined;
  onUse: (minutes: number) => void;
}) {
  const { t } = useTranslation('quests');
  const format = useFormat();
  const [dismissed, setDismissed] = useState<number | null>(null);
  if (!ratios || guessMinutes === null || dismissed === guessMinutes) return null;
  const suggestion = suggestAdjustedGuess(guessMinutes, ratioFor(ratios, categoryId));
  if (!suggestion) return null;
  const minutes = format.duration(suggestion.suggestedMinutes * 60_000);
  return (
    <Card tone="sunken" padding="sm" className="flex flex-col gap-2" role="note">
      <p className="text-sm">
        {t('estimate.suggestion', {
          ratio: format.number(suggestion.ratio, { maximumFractionDigits: 1 }),
          minutes,
        })}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="soft" onClick={() => onUse(suggestion.suggestedMinutes)}>
          {t('estimate.use', { minutes })}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setDismissed(guessMinutes)}>
          {t('estimate.keep')}
        </Button>
      </div>
    </Card>
  );
}

export function DueFields({
  date,
  time,
  onChange,
  idPrefix,
}: {
  date: string;
  time: string;
  onChange: (date: string, time: string) => void;
  idPrefix: string;
}) {
  const { t } = useTranslation('quests');
  const format = useFormat();
  const shown =
    date && format.lang === 'fa'
      ? format.date(date, 'long') +
        (time ? ` · ${format.time(localDateTimeToMs(date, time))}` : '')
      : null;
  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-bold text-text">{t('form.due')}</legend>
      <div className="flex flex-wrap items-end gap-2">
        <Input
          id={`${idPrefix}-due-date`}
          type="date"
          label={t('form.due_date')}
          value={date}
          onChange={(e) => onChange(e.target.value, e.target.value ? time : '')}
          wrapperClassName="min-w-0 flex-[2_1_10rem]"
        />
        <Input
          id={`${idPrefix}-due-time`}
          type="time"
          label={t('form.due_time')}
          value={time}
          disabled={!date}
          onChange={(e) => onChange(date, e.target.value)}
          wrapperClassName="min-w-0 flex-[1_1_7rem]"
        />
        {date && (
          <Button variant="ghost" size="sm" onClick={() => onChange('', '')} className="mb-1">
            {t('form.clear_due')}
          </Button>
        )}
      </div>
      {shown && <p className="text-sm text-muted">{shown}</p>}
    </fieldset>
  );
}

export function CategoryField({
  value,
  onChange,
}: {
  value: Uuid | null;
  onChange: (id: Uuid | null) => void;
}) {
  const { t } = useTranslation('quests');
  const categories = useCategories();
  const categoryName = useCategoryName();
  return (
    <fieldset className="flex min-w-0 flex-col">
      <legend className="mb-2 text-sm font-bold text-text">{t('form.category')}</legend>
      <div className="flex flex-wrap gap-1.5">
        <ToggleChip selected={value === null} onChange={() => onChange(null)}>
          {t('form.no_category')}
        </ToggleChip>
        {(categories ?? []).map((c) => (
          <ToggleChip
            key={c.id}
            dotColor={c.color}
            selected={value === c.id}
            onChange={() => onChange(value === c.id ? null : c.id)}
          >
            {categoryName(c)}
          </ToggleChip>
        ))}
        <Link
          to="/quests/categories"
          className="inline-flex min-h-9 items-center px-2 text-sm font-bold text-primary hover:underline"
        >
          {t('form.manage_categories')}
        </Link>
      </div>
    </fieldset>
  );
}

export function TagsField({
  value,
  onChange,
  idPrefix,
}: {
  value: Uuid[];
  onChange: (ids: Uuid[]) => void;
  idPrefix: string;
}) {
  const { t } = useTranslation('quests');
  const tags = useTags();
  const [name, setName] = useState('');
  const add = async () => {
    if (!name.trim().replace(/^#/, '')) return;
    const tag = await ensureTag(name);
    if (!value.includes(tag.id)) onChange([...value, tag.id]);
    setName('');
  };
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-2 text-sm font-bold text-text">{t('form.tags')}</legend>
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <ToggleChip
              key={tag.id}
              selected={value.includes(tag.id)}
              onChange={() => onChange(toggleIn(value, tag.id))}
            >
              #{tag.name}
            </ToggleChip>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <label htmlFor={`${idPrefix}-tag`} className="ql-visually-hidden">
          {t('form.new_tag')}
        </label>
        <input
          id={`${idPrefix}-tag`}
          value={name}
          placeholder={t('form.new_tag_placeholder')}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void add();
            }
          }}
          className={cx(controlClass, 'min-h-10 min-w-0 flex-1 py-1.5')}
        />
        <Button variant="secondary" size="sm" onClick={add} className="min-h-10">
          {t('form.add_tag')}
        </Button>
      </div>
    </fieldset>
  );
}

/** Week days in display order for the player's week start. */
function weekOrder(weekStartsOn: number): number[] {
  return Array.from({ length: 7 }, (_, i) => (weekStartsOn + i) % 7);
}

export function RecurrenceFields({
  value,
  onChange,
  weekStartsOn,
  idPrefix,
}: {
  value: RecurrenceDraft;
  onChange: (r: RecurrenceDraft) => void;
  weekStartsOn: number;
  idPrefix: string;
}) {
  const { t } = useTranslation('quests');
  const format = useFormat();
  // 2026-03-08 is a Sunday: day d of the week is 2026-03-(08+d).
  const dayName = (d: number) =>
    new Intl.DateTimeFormat(format.lang === 'fa' ? 'fa-IR' : 'en-US', { weekday: 'short' }).format(
      new Date(2026, 2, 8 + d, 12),
    );
  const n = parseMinutes(value.interval);
  return (
    <div className="flex flex-col gap-3">
      <Select
        id={`${idPrefix}-repeat`}
        label={t('form.repeat')}
        value={value.kind}
        onChange={(e) => onChange({ ...value, kind: e.target.value as RecurrenceDraft['kind'] })}
        options={(['none', 'daily', 'weekly', 'weekdays', 'every_n_days'] as const).map((k) => ({
          value: k,
          label: t(`recurrence.${k}`),
        }))}
        hint={value.kind !== 'none' ? t('recurrence.hint') : undefined}
      />
      {value.kind === 'weekdays' && (
        <fieldset className="flex flex-col">
          <legend className="mb-2 text-sm font-bold text-text">{t('recurrence.on_days')}</legend>
          <div className="flex flex-wrap gap-1.5">
            {weekOrder(weekStartsOn).map((d) => (
              <ToggleChip
                key={d}
                selected={value.weekdays.includes(d)}
                onChange={() => onChange({ ...value, weekdays: toggleIn(value.weekdays, d) })}
              >
                {dayName(d)}
              </ToggleChip>
            ))}
          </div>
          {value.weekdays.length === 0 && (
            <p className="mt-1.5 text-sm text-muted">{t('recurrence.pick_a_day')}</p>
          )}
        </fieldset>
      )}
      {value.kind === 'every_n_days' && (
        <Input
          id={`${idPrefix}-interval`}
          inputMode="numeric"
          label={t('recurrence.every_n_label')}
          value={value.interval}
          onChange={(e) => onChange({ ...value, interval: e.target.value })}
          hint={
            n !== null && n >= 2
              ? t('recurrence.every_n_preview', { count: n, n: format.number(n) })
              : t('recurrence.every_n_min')
          }
          className="max-w-28"
        />
      )}
    </div>
  );
}

export function SuggestionNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-sm text-muted" role="status">
      <Icon name="sparkle" size="1.1em" className="mt-0.5 text-xp" />
      <span>{children}</span>
    </p>
  );
}
