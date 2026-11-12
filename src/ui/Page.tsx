import type { ReactNode } from 'react';
import { cx } from './cx';

export interface PageProps {
  /** The page's h1. */
  title: ReactNode;
  /** A short friendly line under the title. */
  subtitle?: ReactNode;
  /** Buttons on the end side of the title row. */
  actions?: ReactNode;
  /** Hide the title visually (still read by screen readers). */
  hideTitle?: boolean;
  className?: string;
  children?: ReactNode;
}

/** Standard page layout inside the app shell: title row and a content column. */
export function Page({ title, subtitle, actions, hideTitle, className, children }: PageProps) {
  return (
    <div className={cx('mx-auto flex w-full max-w-3xl flex-col gap-5', className)}>
      <header
        className={cx(
          'flex flex-wrap items-end justify-between gap-3',
          hideTitle && 'ql-visually-hidden',
        )}
      >
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold text-text sm:text-4xl">{title}</h1>
          {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </header>
      {children}
    </div>
  );
}

/** A titled group inside a page. */
export function Section({
  title,
  description,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx('flex flex-col gap-3', className)}>
      <div>
        <h2 className="text-xl font-semibold text-text">{title}</h2>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}
