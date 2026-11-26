import { lazyPage } from '@/app/lazyPage';
import type { FeatureRoutes } from '@/app/routing';
import { HISTORY_ROUTE } from './paths';

/**
 * OWNER: Focus package. Focus mode is full screen; the history lives in the shell. Both load
 * on first use (precached by the service worker, so still instant and offline).
 */
export const routes: FeatureRoutes = {
  shell: [
    { path: HISTORY_ROUTE, Component: lazyPage(() => import('./HistoryPage'), 'HistoryPage') },
  ],
  fullscreen: [
    { path: 'focus/:sessionId?', Component: lazyPage(() => import('./FocusPage'), 'FocusPage') },
  ],
};
