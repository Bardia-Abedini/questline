import type { FeatureRoutes } from '@/app/routing';
import { StatsPage } from './StatsPage';

/** OWNER: Finish package. */
export const routes: FeatureRoutes = {
  shell: [{ path: 'stats', element: <StatsPage /> }],
};
