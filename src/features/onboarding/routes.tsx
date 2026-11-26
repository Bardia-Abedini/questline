import { lazyPage } from '@/app/lazyPage';
import type { FeatureRoutes } from '@/app/routing';

/** OWNER: Finish package. The welcome screens are full screen and loaded only when shown. */
export const routes: FeatureRoutes = {
  fullscreen: [
    {
      path: 'welcome',
      Component: lazyPage(() => import('./OnboardingPage'), 'OnboardingPage'),
    },
  ],
};
