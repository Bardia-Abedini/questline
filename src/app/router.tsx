import { createBrowserRouter, type RouteObject } from 'react-router';
import { routes as cloud } from '@/features/cloud/routes';
import { routes as focus } from '@/features/focus/routes';
import { routes as game } from '@/features/game/routes';
import { routes as onboarding } from '@/features/onboarding/routes';
import { routes as quests } from '@/features/quests/routes';
import { routes as settings } from '@/features/settings/routes';
import { routes as stats } from '@/features/stats/routes';
import { routes as today } from '@/features/today/routes';
import { RouteErrorElement } from './ErrorBoundary';
import { NotFoundPage } from './NotFoundPage';
import { DevUiRoute, Root } from './RootLayout';
import type { FeatureRoutes } from './routing';
import { AppShell, FullscreenLayout } from './shell/AppShell';

/** Every feature's routes. Foundation-owned; packages edit only their own routes.tsx. */
const FEATURES: FeatureRoutes[] = [today, quests, focus, game, cloud, stats, settings, onboarding];

export function buildRoutes(): RouteObject[] {
  return [
    {
      element: <Root />,
      errorElement: <RouteErrorElement />,
      children: [
        {
          element: <AppShell />,
          children: [
            ...FEATURES.flatMap((f) => f.shell ?? []),
            { path: '*', element: <NotFoundPage /> },
          ],
        },
        {
          element: <FullscreenLayout />,
          children: [
            ...FEATURES.flatMap((f) => f.fullscreen ?? []),
            {
              path: 'dev/ui',
              element: <DevUiRoute />,
            },
          ],
        },
      ],
    },
  ];
}

export function createAppRouter() {
  return createBrowserRouter(buildRoutes());
}
