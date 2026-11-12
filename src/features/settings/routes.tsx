import type { FeatureRoutes } from '@/app/routing';
import { SettingsPage } from './SettingsPage';

/** OWNER: Finish package. */
export const routes: FeatureRoutes = {
  shell: [{ path: 'settings', element: <SettingsPage /> }],
};
