import type { FeatureRoutes } from '@/app/routing';
import { QuestsPage } from './QuestsPage';

/** OWNER: Quests package. Add quest detail, edit and template routes here. */
export const routes: FeatureRoutes = {
  shell: [{ path: 'quests', element: <QuestsPage /> }],
};
