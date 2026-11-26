import { lazyPage } from '@/app/lazyPage';
import type { FeatureRoutes } from '@/app/routing';

/** OWNER: Cloud package. The pages load on first visit (precached for offline use). */
export const routes: FeatureRoutes = {
  shell: [
    { path: 'account', Component: lazyPage(() => import('./pages/AccountPage'), 'AccountPage') },
    {
      path: 'brain-dump',
      Component: lazyPage(() => import('./pages/BrainDumpPage'), 'BrainDumpPage'),
    },
    {
      path: 'calendar',
      Component: lazyPage(() => import('./pages/CalendarPage'), 'CalendarPage'),
    },
  ],
};
