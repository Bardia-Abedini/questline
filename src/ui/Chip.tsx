import type { HTMLAttributes, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';

export type ChipTone =
  'neutral' | 'primary' | 'accent' | 'xp' | 'gold' | 'success' | 'warning' | 'danger' | 'info';

const TONES: Record<ChipTone, string> = {
  neutral: 'bg-surface-2 text-text border-border',
  primary: 'bg-primary-soft text-text border-primary/30',
  accent: 'bg-accent-soft text-text border-accent/30',
  xp: 'bg-xp-soft text-text border-xp/30',
  gold: 'bg-gold-soft text-gold-text border-gold/30',
  success: 'bg-success-soft text-success border-success/30',
  warning: 'bg-warning-soft text-warning border-warning/30',
  danger: 'bg-danger-soft text-danger border-danger/30',
  info: 'bg-info-soft text-info border-info/30',
};

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: ChipTone;
  icon?: IconName;
  /** A category color token suffix (sky, sage, rose...). Shows a colored dot. */
  dotColor?: string;
  /** Shows a remove button with this accessible label context. */
  onRemove?: () => void;
  size?: 'sm' | 'md';
  children: ReactNode;
}

/** Small label: difficulty, category, tag, status. */
export function Chip({
  tone = 'neutral',
  icon,
  dotColor,
  onRemove,
  size = 'md',
  className,
  children,
  ...rest
}: ChipProps) {
  const { t } = useTranslation('common');
  return (
    <span
      className={cx(
        'inline-flex max-w-full items-center gap-1 rounded-full border font-bold',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        TONES[tone],
        className,
      )}
      {...rest}
    >
      {dotColor && (
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full"
          style={{ background: `var(--ql-cat-${dotColor})` }}
        />
      )}
      {icon && <Icon name={icon} size="1em" />}
      <span className="truncate">{children}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={t('remove_item', { item: typeof children === 'string' ? children : '' })}
          className="-me-1 ms-0.5 inline-flex size-5 items-center justify-center rounded-full hover:bg-black/10"
        >
          <Icon name="close" size="0.85em" />
        </button>
      )}
    </span>
  );
}

export interface ToggleChipProps extends Omit<HTMLAttributes<HTMLButtonElement>, 'onChange'> {
  selected: boolean;
  onChange: (selected: boolean) => void;
  icon?: IconName;
  dotColor?: string;
  disabled?: boolean;
  children: ReactNode;
}

/** A selectable chip (filters, tag pickers). Uses aria-pressed. */
export function ToggleChip({
  selected,
  onChange,
  icon,
  dotColor,
  disabled,
  className,
  children,
  ...rest
}: ToggleChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={() => onChange(!selected)}
      className={cx(
        'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-bold transition-colors duration-150',
        selected
          ? 'border-primary bg-primary text-on-primary shadow-sm'
          : 'border-border-strong bg-surface text-text hover:bg-surface-2',
        'disabled:opacity-55',
        className,
      )}
      {...rest}
    >
      {selected ? <Icon name="check" size="1em" /> : icon && <Icon name={icon} size="1em" />}
      {dotColor && !selected && (
        <span
          aria-hidden
          className="size-2 rounded-full"
          style={{ background: `var(--ql-cat-${dotColor})` }}
        />
      )}
      {children}
    </button>
  );
}
