import { lazyPage } from '@/app/lazyPage';
import type { FeatureRoutes } from '@/app/routing';

/** OWNER: Finish package. Loaded on first visit. */
export const routes: FeatureRoutes = {
  shell: [
    { path: 'settings', Component: lazyPage(() => import('./SettingsPage'), 'SettingsPage') },
  ],
};
