import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from './cx';
import { isRtl } from './direction';
import { Icon, type IconName } from './Icon';

export interface SegmentOption<V extends string> {
  value: V;
  label: ReactNode;
  icon?: IconName;
}

export interface SegmentedControlProps<V extends string> {
  /** Accessible name of the group. */
  label: string;
  /** Show the label above the control. */
  showLabel?: boolean;
  options: readonly SegmentOption<V>[];
  value: V;
  onChange: (value: V) => void;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * One choice out of a few (radiogroup). When the options do not fit on one line (larger text,
 * dyslexia font) they wrap onto a second row instead of overflowing. Arrow keys move the selection and follow the
 * reading direction (ArrowRight moves backwards in RTL).
 */
export function SegmentedControl<V extends string>({
  label,
  showLabel = false,
  options,
  value,
  onChange,
  size = 'md',
  className,
}: SegmentedControlProps<V>) {
  const labelId = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const rtl = isRtl(e.currentTarget);
    const index = options.findIndex((o) => o.value === value);
    let next = index;
    if (e.key === 'ArrowRight') next = index + (rtl ? -1 : 1);
    else if (e.key === 'ArrowLeft') next = index + (rtl ? 1 : -1);
    else if (e.key === 'ArrowDown') next = index + 1;
    else if (e.key === 'ArrowUp') next = index - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = options.length - 1;
    else return;
    e.preventDefault();
    next = (next + options.length) % options.length;
    onChange(options[next]!.value);
    refs.current[next]?.focus();
  };

  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <span
        id={labelId}
        className={cx('text-sm font-bold text-text', !showLabel && 'ql-visually-hidden')}
      >
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        onKeyDown={onKeyDown}
        className="flex w-full flex-wrap gap-y-1 rounded-[1.375rem] border border-border bg-surface-2 p-1"
      >
        {options.map((o, i) => {
          const selected = o.value === value;
          return (
            <button
              key={o.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(o.value)}
              className={cx(
                'inline-flex min-w-0 flex-auto items-center justify-center gap-1.5 rounded-full font-bold transition-[background-color,color,box-shadow] duration-150 ease-cozy',
                size === 'sm' ? 'min-h-8 px-2.5 text-sm' : 'min-h-10 px-3 text-sm sm:text-base',
                selected ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text',
              )}
            >
              {o.icon && <Icon name={o.icon} size="1.1em" />}
              <span className="min-w-0 text-center leading-tight break-words">{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
