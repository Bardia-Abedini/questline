import type { RouteObject } from 'react-router';

/**
 * What a feature package contributes to the router. Each feature exports one of these from
 * `src/features/<feature>/routes.tsx`; src/app/router.tsx already imports every feature's
 * routes, so adding a route never means editing a shared file.
 *
 * - `shell`: pages inside the app chrome (header + tab bar / side bar). Paths are relative
 *   to "/", e.g. `{ path: 'quests/:questId', element: <QuestDetail /> }`.
 * - `fullscreen`: pages with no chrome at all (focus mode, onboarding).
 */
export interface FeatureRoutes {
  shell?: RouteObject[];
  fullscreen?: RouteObject[];
}

/** Paths of the six main tabs. Use these instead of string literals when linking. */
export const PATHS = {
  today: '/',
  quests: '/quests',
  home: '/home',
  shop: '/shop',
  stats: '/stats',
  settings: '/settings',
  focus: '/focus',
  devUi: '/dev/ui',
} as const;
