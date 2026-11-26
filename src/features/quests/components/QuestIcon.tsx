import type { SVGProps } from 'react';
import { cx, Icon, type IconName } from '@/ui';

/**
 * A few icons only the Quests screens need, drawn in the same style as `@/ui` icons.
 * Anything in the shared set is passed straight through to `<Icon>`.
 */
const LOCAL = {
  'arrow-up': <path d="M12 19V5M6 11l6-6 6 6" />,
  'arrow-down': <path d="M12 5v14M6 13l6 6 6-6" />,
  repeat: (
    <>
      <path d="M17 3.5 20 6.5l-3 3" />
      <path d="M4 11.5v-1a4 4 0 0 1 4-4h12" />
      <path d="M7 20.5 4 17.5l3-3" />
      <path d="M20 12.5v1a4 4 0 0 1-4 4H4" />
    </>
  ),
  tag: (
    <>
      <path d="M3.5 12.2V4.8a1.3 1.3 0 0 1 1.3-1.3h7.4l8.3 8.3a1.3 1.3 0 0 1 0 1.8l-7.4 7.4a1.3 1.3 0 0 1-1.8 0Z" />
      <circle cx="8.3" cy="8.3" r="1.4" />
    </>
  ),
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  steps: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="m3.5 6 1.2 1.2L7 5M3.5 12l1.2 1.2L7 11" />
      <circle cx="5" cy="18" r="1.2" />
    </>
  ),
  template: (
    <>
      <rect x="4" y="3.5" width="12" height="15" rx="2" />
      <path d="M8 21h10a2 2 0 0 0 2-2V7" />
      <path d="M7.5 8h5M7.5 12h5" />
    </>
  ),
  'more-up': <path d="M6 14.5l6-6 6 6" />,
} as const;

export type QuestIconName = IconName | keyof typeof LOCAL;

export function QuestIcon({
  name,
  size = '1.25em',
  className,
  ...rest
}: { name: QuestIconName; size?: number | string } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  if (!(name in LOCAL)) return <Icon name={name as IconName} size={size} className={className} />;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      className={cx('inline-block shrink-0', className)}
      {...rest}
    >
      {LOCAL[name as keyof typeof LOCAL]}
    </svg>
  );
}
