import type { FeatureRoutes } from '@/app/routing';
import { OnboardingPage } from './OnboardingPage';

/** OWNER: Finish package. The welcome screens are full screen. */
export const routes: FeatureRoutes = {
  fullscreen: [{ path: 'welcome', element: <OnboardingPage /> }],
};
