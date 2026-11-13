import type { FeatureRoutes } from '@/app/routing';
import { CategoriesPage } from './pages/CategoriesPage';
import { QuestDetailPage } from './pages/QuestDetailPage';
import { QuestFormPage } from './pages/QuestFormPage';
import { QuestsPage } from './pages/QuestsPage';
import { TemplatesPage } from './pages/TemplatesPage';

/** OWNER: Quests package. */
export const routes: FeatureRoutes = {
  shell: [
    { path: 'quests', element: <QuestsPage /> },
    { path: 'quests/new', element: <QuestFormPage key="new" /> },
    { path: 'quests/templates', element: <TemplatesPage /> },
    { path: 'quests/categories', element: <CategoriesPage /> },
    { path: 'quests/:questId', element: <QuestDetailPage /> },
    { path: 'quests/:questId/edit', element: <QuestFormPage key="edit" /> },
  ],
};
