import type { FeatureRoutes } from '@/app/routing';
import { StatsRoute } from './StatsRoute';

/** OWNER: Finish package. */
export const routes: FeatureRoutes = {
  shell: [{ path: 'stats', element: <StatsRoute /> }],
};
