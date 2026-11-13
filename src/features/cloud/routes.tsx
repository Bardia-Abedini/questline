import type { FeatureRoutes } from '@/app/routing';
import { AccountPage } from './pages/AccountPage';
import { BrainDumpPage } from './pages/BrainDumpPage';
import { CalendarPage } from './pages/CalendarPage';

/** OWNER: Cloud package. */
export const routes: FeatureRoutes = {
  shell: [
    { path: 'account', element: <AccountPage /> },
    { path: 'brain-dump', element: <BrainDumpPage /> },
    { path: 'calendar', element: <CalendarPage /> },
  ],
};
