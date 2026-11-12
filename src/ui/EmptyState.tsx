import type { ReactNode } from 'react';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';

export interface EmptyStateProps {
  icon?: IconName;
  /** Custom illustration instead of the icon. */
  illustration?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  /** Buttons. */
  action?: ReactNode;
  className?: string;
}

/** A calm, friendly placeholder for empty lists and pages still to come. Never blames the user. */
export function EmptyState({
  icon = 'sparkle',
  illustration,
  title,
  children,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cx(
        'mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border border-dashed border-border-strong bg-surface/60 px-6 py-10 text-center',
        className,
      )}
    >
      {illustration ?? (
        <div className="relative mb-1 grid size-20 place-items-center rounded-full bg-primary-soft text-primary shadow-sm">
          <Icon name={icon} size={40} />
          <span aria-hidden className="absolute -end-1 top-1 text-gold">
            <Icon name="sparkle" size={18} filled />
          </span>
        </div>
      )}
      <h2 className="text-xl font-semibold text-text">{title}</h2>
      {children && <div className="text-muted">{children}</div>}
      {action && <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
