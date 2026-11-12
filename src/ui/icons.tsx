/**
 * Inline SVG icon set. 24x24 grid, 1.75 stroke, round caps and joins: soft and friendly.
 * Add icons by adding an entry to ICONS (Foundation-owned; features may add icons in their
 * own folder with the same props instead of editing this file).
 */
export const ICONS = {
  today: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v1.5M12 19.5V21M4.6 4.6l1.1 1.1M18.3 18.3l1.1 1.1M3 12h1.5M19.5 12H21M4.6 19.4l1.1-1.1M18.3 5.7l1.1-1.1" />
    </>
  ),
  quests: (
    <>
      <path d="M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7" />
      <path d="M7 4a2 2 0 0 0-2 2v1h4V6a2 2 0 0 0-2-2ZM7 20a2 2 0 0 1-2-2v-1h4v1a2 2 0 0 1-2 2Z" />
      <path d="M11 9h5M11 12.5h5M11 16h3" />
    </>
  ),
  home: (
    <>
      <path d="M4 11.5 12 5l8 6.5" />
      <path d="M6 10v9a1 1 0 0 0 1 1h3.5v-5h3v5H17a1 1 0 0 0 1-1v-9" />
      <path d="M16 6.5V4.5h2v3.6" />
    </>
  ),
  shop: (
    <>
      <path d="M5 8h14l-1.2 11.1a1 1 0 0 1-1 .9H7.2a1 1 0 0 1-1-.9L5 8Z" />
      <path d="M9 10V7a3 3 0 0 1 6 0v3" />
    </>
  ),
  stats: (
    <>
      <path d="M4 20h16" />
      <rect x="5.5" y="12" width="3" height="5.5" rx="1" />
      <rect x="10.5" y="7" width="3" height="10.5" rx="1" />
      <rect x="15.5" y="10" width="3" height="7.5" rx="1" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5" />
      <circle cx="12" cy="12" r="6.6" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  'chevron-forward': <path d="M9.5 6l6 6-6 6" />,
  'chevron-back': <path d="M14.5 6l-6 6 6 6" />,
  'chevron-down': <path d="M6 9.5l6 6 6-6" />,
  'arrow-forward': <path d="M5 12h14M13 6l6 6-6 6" />,
  star: <path d="M12 3.8l2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8L12 3.8Z" />,
  coin: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="5" />
      <path d="M12 9.5v5" />
    </>
  ),
  flame: (
    <path d="M12 21c3.6 0 6-2.4 6-5.8 0-3.3-2.3-5.4-3.6-7.6-.4 1.6-1.3 2.6-2.4 3C12.4 7.4 11 5 8.8 3.5c.2 2.7-1.2 4.5-2.4 6.2C5.6 10.9 6 12.3 6 15.2 6 18.6 8.4 21 12 21Z" />
  ),
  sparkle: (
    <>
      <path d="M12 3.5l1.6 5 5 1.6-5 1.6-1.6 5-1.6-5-5-1.6 5-1.6L12 3.5Z" />
      <path d="M18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z" />
    </>
  ),
  heart: <path d="M12 19.5s-7-4.3-7-9.3A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.2c0 5-7 9.3-7 9.3Z" />,
  book: (
    <>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5v-15Z" />
      <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5v-15Z" />
    </>
  ),
  leaf: (
    <>
      <path d="M5 19c0-8 5-13.5 14-14-.5 9-6 14-14 14Z" />
      <path d="M5 19l7-7" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
    </>
  ),
  moon: <path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10Z" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.3 2.4 3.5 5.2 3.5 8.5s-1.2 6.1-3.5 8.5c-2.3-2.4-3.5-5.2-3.5-8.5s1.2-6.1 3.5-8.5Z" />
    </>
  ),
  'text-size': (
    <>
      <path d="M4 18l4.5-11L13 18M5.6 14.2h5.8" />
      <path d="M14.5 18l2.8-7 2.7 7M15.4 16h3.8" />
    </>
  ),
  timer: (
    <>
      <circle cx="12" cy="13.5" r="7" />
      <path d="M12 13.5V10M10 3h4M18.5 6.5l1.2-1.2" />
    </>
  ),
  play: <path d="M8 5.5v13l10.5-6.5L8 5.5Z" />,
  pause: <path d="M8.5 5.5v13M15.5 5.5v13" />,
  stop: <rect x="6.5" y="6.5" width="11" height="11" rx="2" />,
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.8v.2" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4.5 20.5 19h-17L12 4.5Z" />
      <path d="M12 10v4.2M12 16.6v.2" />
    </>
  ),
  trash: (
    <>
      <path d="M5 7h14M10 4h4M7 7l.8 12a1 1 0 0 0 1 1h6.4a1 1 0 0 0 1-1L17 7" />
      <path d="M10.5 10.5v6M13.5 10.5v6" />
    </>
  ),
  edit: (
    <>
      <path d="M5 19l1-4L16 5l3 3L9 18l-4 1Z" />
      <path d="M14 7l3 3" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M15.5 15.5 20 20" />
    </>
  ),
  inbox: (
    <>
      <path d="M4 13.5 6.5 5h11L20 13.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5.5Z" />
      <path d="M4 13.5h4.5l1 2h5l1-2H20" />
    </>
  ),
  archive: (
    <>
      <rect x="3.5" y="4.5" width="17" height="4" rx="1" />
      <path d="M5 8.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5M10 12.5h4" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
    </>
  ),
  sword: (
    <>
      <path d="M19.5 4.5 10 14l-1.5 1.5M19.5 4.5V8l-7.8 7.8M19.5 4.5H16L8.2 12.3" />
      <path d="M6.5 13.5l4 4M5 19l2.5-2.5" />
    </>
  ),
  potion: (
    <>
      <path d="M10 3.5h4M10.5 3.5v4.2L6.3 15a4.5 4.5 0 0 0 3.9 6h3.6a4.5 4.5 0 0 0 3.9-6l-4.2-7.3V3.5" />
      <path d="M7.5 14.5h9" />
    </>
  ),
  gift: (
    <>
      <rect x="4" y="9" width="16" height="11" rx="1.5" />
      <path d="M3.5 9h17M12 9v11M12 9c-1.5-3.5-5.5-4-5.5-1.5S10 9 12 9Zm0 0c1.5-3.5 5.5-4 5.5-1.5S14 9 12 9Z" />
    </>
  ),
  bolt: <path d="M13 3.5 5.5 13.5H11l-1 7 7.5-10H12l1-7Z" />,
  battery: (
    <>
      <rect x="3.5" y="7.5" width="15" height="9" rx="2" />
      <path d="M21 10.5v3" />
    </>
  ),
  music: (
    <>
      <path d="M9 17.5V6l10-2v11.5" />
      <circle cx="6.5" cy="17.5" r="2.5" />
      <circle cx="16.5" cy="15.5" r="2.5" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  refresh: (
    <>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.5 4.5v4h-4" />
    </>
  ),
  cloud: <path d="M7 18.5h10.5a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6-1.3A4.7 4.7 0 0 0 7 18.5Z" />,
  menu: <path d="M4.5 7h15M4.5 12h15M4.5 17h15" />,
  palette: (
    <>
      <path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.1 0 1.7-.8 1.7-1.6 0-1.2-1-1.4-1-2.5 0-.9.7-1.4 1.6-1.4H17a3.5 3.5 0 0 0 3.5-3.5c0-4.4-3.8-8-8.5-8Z" />
      <circle cx="8" cy="11" r="1" />
      <circle cx="11" cy="7.5" r="1" />
      <circle cx="15.5" cy="8.5" r="1" />
    </>
  ),
  accessibility: (
    <>
      <circle cx="12" cy="4.8" r="1.6" />
      <path d="M5 8.5c2.3.7 4.6 1 7 1s4.7-.3 7-1M12 9.5v4.5M12 14l-3 6M12 14l3 6" />
    </>
  ),
  volume: (
    <>
      <path d="M4.5 9.5h3l4.5-4v13l-4.5-4h-3v-5Z" />
      <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
    </>
  ),
  feather: (
    <>
      <path d="M19.5 4.5c-6 0-11 4-11 11v4" />
      <path d="M19.5 4.5c0 7-4.5 11-11 11M8.5 15.5 5 19" />
    </>
  ),
  lantern: (
    <>
      <path d="M9 3.5h6M12 3.5v2M8 7.5h8l-1 11H9l-1-11Z" />
      <path d="M12 11c1 1.2 1.5 2.2 1.5 3a1.5 1.5 0 1 1-3 0c0-.8.5-1.8 1.5-3ZM7.5 20.5h9" />
    </>
  ),
} as const;

export type IconName = keyof typeof ICONS;
export const ICON_NAMES = Object.keys(ICONS) as IconName[];
