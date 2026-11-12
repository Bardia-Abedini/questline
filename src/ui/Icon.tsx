import type { SVGProps } from 'react';
import { cx } from './cx';
import { ICONS, type IconName } from './icons';

export type { IconName };

/** Icons that point in a reading direction; they mirror in RTL. */
const DIRECTIONAL = new Set<IconName>(['chevron-forward', 'chevron-back', 'arrow-forward']);

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  /** Size in px or any CSS length. Default 1.25em (scales with text). */
  size?: number | string;
  /** Accessible name. Without it the icon is decorative (aria-hidden). */
  title?: string;
  /** Use a filled shape instead of an outline (for star, heart, coin, flame...). */
  filled?: boolean;
}

export function Icon({
  name,
  size = '1.25em',
  title,
  filled = false,
  className,
  ...rest
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
      className={cx('inline-block shrink-0', DIRECTIONAL.has(name) && 'ql-flip-rtl', className)}
      {...rest}
    >
      {ICONS[name]}
    </svg>
  );
}
