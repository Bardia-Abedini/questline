import type { FeatureRoutes } from '@/app/routing';
import { FocusPage } from './FocusPage';

/** OWNER: Focus package. Focus mode is full screen (no header, no tab bar). */
export const routes: FeatureRoutes = {
  fullscreen: [{ path: 'focus/:sessionId?', element: <FocusPage /> }],
};
