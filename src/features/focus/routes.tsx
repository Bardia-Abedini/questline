import type { FeatureRoutes } from '@/app/routing';
import { FocusPage } from './FocusPage';
import { HistoryPage } from './HistoryPage';
import { HISTORY_ROUTE } from './paths';

/** OWNER: Focus package. Focus mode is full screen; the history lives in the shell. */
export const routes: FeatureRoutes = {
  shell: [{ path: HISTORY_ROUTE, element: <HistoryPage /> }],
  fullscreen: [{ path: 'focus/:sessionId?', element: <FocusPage /> }],
};
