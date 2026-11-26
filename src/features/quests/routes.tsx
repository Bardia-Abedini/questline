import { lazyPage } from '@/app/lazyPage';
import type { FeatureRoutes } from '@/app/routing';
import { QuestsPage } from './pages/QuestsPage';

const form = () => import('./pages/QuestFormPage');

/**
 * OWNER: Quests package. The list loads with the app; the other pages on first visit.
 * New and edit get separate components, so switching between them remounts the form.
 */
export const routes: FeatureRoutes = {
  shell: [
    { path: 'quests', element: <QuestsPage /> },
    { path: 'quests/new', Component: lazyPage(form, 'QuestFormPage') },
    {
      path: 'quests/templates',
      Component: lazyPage(() => import('./pages/TemplatesPage'), 'TemplatesPage'),
    },
    {
      path: 'quests/categories',
      Component: lazyPage(() => import('./pages/CategoriesPage'), 'CategoriesPage'),
    },
    {
      path: 'quests/:questId',
      Component: lazyPage(() => import('./pages/QuestDetailPage'), 'QuestDetailPage'),
    },
    { path: 'quests/:questId/edit', Component: lazyPage(form, 'QuestFormPage') },
  ],
};
