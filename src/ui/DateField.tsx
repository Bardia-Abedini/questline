import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { addDays, dayOfWeek, type LocalDate } from '@/domain/dates';
import {
  addJalaliMonths,
  jalaliMonthLength,
  jalaliToLocalDate,
  localDateToJalali,
  type JalaliDate,
} from '@/domain/jalali';
import { useFormat } from '@/i18n/useFormat';
import { Button } from './Button';
import { cx } from './cx';
import { Dialog } from './Dialog';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { Input } from './Input';
import { controlClass } from './fieldStyles';

export interface DateFieldProps {
  label: string;
  /** `YYYY-MM-DD` (Gregorian, as stored) or '' for none. */
  value: string;
  onChange: (value: string) => void;
  /** Earliest day that can be picked. */
  min?: string;
  id?: string;
  disabled?: boolean;
  wrapperClassName?: string;
}

/**
 * A date input. In English it is the browser's own date input. In Persian it is a Jalali
 * calendar (Saturday first, Persian month names and digits) that stores the same
 * Gregorian `YYYY-MM-DD` value. Keyboard: arrows move by day (following the reading
 * direction), Page Up / Page Down by month, Home / End to the week's ends, Enter picks.
 */
export function DateField(props: DateFieldProps) {
  const { lang } = useFormat();
  if (lang !== 'fa') {
    const { label, value, onChange, min, id, disabled, wrapperClassName } = props;
    return (
      <Input
        id={id}
        type="date"
        label={label}
        value={value}
        min={min}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        wrapperClassName={wrapperClassName}
      />
    );
  }
  return <JalaliDateField {...props} />;
}

function todayLocal(): LocalDate {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function JalaliDateField({
  label,
  value,
  onChange,
  min,
  id,
  disabled,
  wrapperClassName,
}: DateFieldProps) {
  const { t } = useTranslation('common');
  const format = useFormat();
  const auto = useId();
  const controlId = id ?? auto;
  const [open, setOpen] = useState(false);
  const dayRef = useRef<HTMLButtonElement>(null);
  return (
    <div className={cx('flex flex-col gap-1.5', wrapperClassName)}>
      <label htmlFor={controlId} className="text-sm font-bold text-text">
        {label}
      </label>
      <button
        id={controlId}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={cx(controlClass, 'flex items-center justify-between gap-2 text-start')}
      >
        <span className={cx('min-w-0 truncate', !value && 'text-faint')}>
          {value ? format.date(value, 'medium') : t('date.choose')}
        </span>
        <Icon name="today" className="shrink-0 text-muted" />
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={label}
        variant="sheet"
        size="sm"
        initialFocus={dayRef}
      >
        <JalaliCalendar
          focusRef={dayRef}
          value={value || null}
          min={min ?? null}
          onPick={(day) => {
            onChange(day);
            setOpen(false);
          }}
        />
      </Dialog>
    </div>
  );
}

/** The month grid. Exported for tests. */
export function JalaliCalendar({
  value,
  min,
  onPick,
  focusRef,
}: {
  focusRef?: RefObject<HTMLButtonElement | null>;
  value: LocalDate | null;
  min: LocalDate | null;
  onPick: (day: LocalDate) => void;
}) {
  const { t } = useTranslation('common');
  const format = useFormat();
  const today = todayLocal();
  const [focusDay, setFocusDay] = useState<LocalDate>(
    () => value ?? (min && min > today ? min : today),
  );
  const view = localDateToJalali(focusDay);
  const gridRef = useRef<HTMLDivElement>(null);
  const moved = useRef(false);

  useEffect(() => {
    if (!moved.current) return;
    gridRef.current?.querySelector<HTMLButtonElement>('[tabindex="0"]')?.focus();
  }, [focusDay]);

  const move = (day: LocalDate) => {
    moved.current = true;
    setFocusDay(day);
  };
  const monthStart = jalaliToLocalDate({ ...view, jd: 1 });
  const length = jalaliMonthLength(view.jy, view.jm);
  // Saturday-first weeks: Saturday (6) is column 0.
  const lead = (dayOfWeek(monthStart) + 1) % 7;
  const cells: Array<LocalDate | null> = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length }, (_, i) => addDays(monthStart, i)),
  ];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
  const weekdayNames = Array.from({ length: 7 }, (_, i) => {
    // 2026-03-07 is a Saturday.
    const day = addDays('2026-03-07', i);
    return { short: format.date(day, 'weekdayNarrow'), long: format.date(day, 'weekday') };
  });
  const goMonth = (delta: number) => {
    const target: JalaliDate = addJalaliMonths(view, delta);
    move(jalaliToLocalDate(target));
  };
  const allowed = (day: LocalDate) => !min || day >= min;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Persian reads right to left: the left arrow moves to the next day.
    const steps: Record<string, number> = {
      ArrowLeft: 1,
      ArrowRight: -1,
      ArrowDown: 7,
      ArrowUp: -7,
    };
    if (e.key in steps) {
      e.preventDefault();
      move(addDays(focusDay, steps[e.key]!));
    } else if (e.key === 'PageDown' || e.key === 'PageUp') {
      e.preventDefault();
      const next = addJalaliMonths(view, e.key === 'PageDown' ? 1 : -1);
      move(jalaliToLocalDate(next));
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      const col = (dayOfWeek(focusDay) + 1) % 7;
      move(addDays(focusDay, e.key === 'Home' ? -col : 6 - col));
    }
  };

  const monthTitle = format.date(monthStart, 'monthYear');

  return (
    <div className="flex flex-col gap-3" data-testid="jalali-calendar">
      <div className="flex items-center justify-between gap-2">
        <IconButton
          icon="chevron-forward"
          label={t('date.previous_month')}
          onClick={() => goMonth(-1)}
        />
        <p className="font-bold text-text" aria-live="polite">
          {monthTitle}
        </p>
        <IconButton icon="chevron-back" label={t('date.next_month')} onClick={() => goMonth(1)} />
      </div>
      <div role="grid" aria-label={monthTitle} ref={gridRef} onKeyDown={onKeyDown}>
        <div role="row" className="grid grid-cols-7 gap-1">
          {weekdayNames.map((w) => (
            <span
              key={w.long}
              role="columnheader"
              aria-label={w.long}
              className="py-1 text-center text-sm font-bold text-muted"
            >
              {w.short}
            </span>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div role="row" key={wi} className="mt-1 grid grid-cols-7 gap-1">
            {week.map((day, di) =>
              day ? (
                <span role="gridcell" key={day} aria-selected={day === value}>
                  <button
                    ref={day === focusDay ? focusRef : undefined}
                    type="button"
                    tabIndex={day === focusDay ? 0 : -1}
                    disabled={!allowed(day)}
                    aria-label={format.date(day, 'long')}
                    aria-current={day === today ? 'date' : undefined}
                    onClick={() => onPick(day)}
                    className={cx(
                      'grid h-11 w-full place-items-center rounded-md text-base font-bold tabular-nums transition-colors',
                      day === value
                        ? 'bg-primary text-on-primary'
                        : day === today
                          ? 'border border-primary text-text'
                          : 'text-text hover:bg-surface-2',
                      'disabled:cursor-not-allowed disabled:opacity-40',
                    )}
                  >
                    {format.number(localDateToJalali(day).jd)}
                  </button>
                </span>
              ) : (
                <span role="gridcell" key={`e${wi}-${di}`} />
              ),
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={!allowed(today)}
          onClick={() => onPick(today)}
        >
          {t('date.today')}
        </Button>
      </div>
    </div>
  );
}
