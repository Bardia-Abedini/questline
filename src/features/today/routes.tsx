import type { FeatureRoutes } from '@/app/routing';
import { TodayPage } from './TodayPage';

/** OWNER: Quests package. The Today board is the index route ("/"). */
export const routes: FeatureRoutes = {
  shell: [{ index: true, element: <TodayPage /> }],
};
