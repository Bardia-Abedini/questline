import type { ReactNode } from 'react';
import { cx } from '@/ui';

export interface ProgressRingProps {
  /** 0..1, how much of the timer has run. */
  progress: number;
  tone?: 'primary' | 'accent';
  /** Dim the ring (paused). */
  muted?: boolean;
  children?: ReactNode;
  className?: string;
}

const R = 92;
const C = 2 * Math.PI * R;

/**
 * A calm ring that fills as the timer runs. Decorative (the timer text inside carries the
 * meaning). It starts at the top and fills in the reading direction (mirrored in RTL).
 */
export function ProgressRing({
  progress,
  tone = 'primary',
  muted,
  children,
  className,
}: ProgressRingProps) {
  const p = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  const color = tone === 'accent' ? 'var(--ql-accent)' : 'var(--ql-primary)';
  return (
    <div className={cx('relative grid aspect-square place-items-center', className)}>
      <svg
        viewBox="0 0 200 200"
        aria-hidden
        className="absolute inset-0 size-full -rotate-90 rtl:-scale-y-100"
      >
        <circle cx="100" cy="100" r={R} fill="none" stroke="var(--ql-surface-3)" strokeWidth="9" />
        <circle
          cx="100"
          cy="100"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - p)}
          opacity={muted ? 0.45 : 1}
          className="transition-[stroke-dashoffset,opacity] duration-1000 ease-linear"
        />
      </svg>
      <div className="relative flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}
