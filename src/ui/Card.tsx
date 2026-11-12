import type { HTMLAttributes, ReactNode, Ref } from 'react';
import { cx } from './cx';

export type CardTone = 'default' | 'sunken' | 'highlight' | 'xp' | 'gold';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section' | 'article' | 'li';
  tone?: CardTone;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Adds hover/press feedback for clickable cards (put the click target inside). */
  interactive?: boolean;
  ref?: Ref<HTMLElement>;
  children?: ReactNode;
}

const TONES: Record<CardTone, string> = {
  default: 'bg-surface border border-border shadow-sm',
  sunken: 'bg-surface-2 border border-transparent',
  highlight: 'bg-primary-soft border border-primary/25',
  xp: 'bg-xp-soft border border-xp/20',
  gold: 'bg-gold-soft border border-gold/25',
};

const PADDING = { none: '', sm: 'p-3', md: 'p-4 sm:p-5', lg: 'p-6 sm:p-8' };

export function Card({
  as: Tag = 'div',
  tone = 'default',
  padding = 'md',
  interactive = false,
  className,
  ref,
  ...rest
}: CardProps) {
  return (
    <Tag
      ref={ref as never}
      className={cx(
        'rounded-lg',
        TONES[tone],
        PADDING[padding],
        interactive &&
          'transition-[transform,box-shadow] duration-150 ease-cozy hover:-translate-y-0.5 hover:shadow-md',
        className,
      )}
      {...rest}
    />
  );
}

export function CardTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cx('text-lg font-semibold text-text', className)} {...rest} />;
}
