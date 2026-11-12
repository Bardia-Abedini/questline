import type { ReactNode } from 'react';
import { cx } from './cx';

export type ProgressTone = 'xp' | 'gold' | 'accent' | 'primary';

export interface ProgressBarProps {
  value: number;
  max?: number;
  /** Accessible name, e.g. "Experience". */
  label: string;
  /** Spoken value, e.g. "75 of 150 XP". Defaults to a percentage. */
  valueText?: string;
  tone?: ProgressTone;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Visible text inside/next to the bar. */
  children?: ReactNode;
  className?: string;
}

const FILL: Record<ProgressTone, string> = {
  xp: 'bg-[linear-gradient(90deg,var(--ql-xp),color-mix(in_oklab,var(--ql-xp)_70%,white))]',
  gold: 'bg-[linear-gradient(90deg,var(--ql-gold),color-mix(in_oklab,var(--ql-gold)_70%,white))]',
  accent: 'bg-accent',
  primary: 'bg-primary',
};
const TRACK: Record<ProgressTone, string> = {
  xp: 'bg-xp-soft',
  gold: 'bg-gold-soft',
  accent: 'bg-accent-soft',
  primary: 'bg-primary-soft',
};
const HEIGHT = { xs: 'h-1.5', sm: 'h-2.5', md: 'h-3.5', lg: 'h-5' };

/**
 * Progress bar (the XP bar). Fills from the start side, so it follows RTL.
 * The fill animates smoothly unless reduced motion is on.
 */
export function ProgressBar({
  value,
  max = 1,
  label,
  valueText,
  tone = 'xp',
  size = 'md',
  children,
  className,
}: ProgressBarProps) {
  const safeMax = max > 0 ? max : 1;
  const ratio = Math.min(1, Math.max(0, value / safeMax));
  return (
    <div className={cx('flex flex-col gap-1', className)}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={Math.min(safeMax, Math.max(0, value))}
        aria-valuetext={valueText ?? `${Math.round(ratio * 100)}%`}
        className={cx('relative w-full overflow-hidden rounded-full', TRACK[tone], HEIGHT[size])}
      >
        <div
          className={cx(
            'absolute inset-y-0 start-0 rounded-full transition-[inline-size] duration-700 ease-cozy',
            FILL[tone],
          )}
          style={{ inlineSize: `${ratio * 100}%` }}
        />
      </div>
      {children}
    </div>
  );
}
