import { lazy, Suspense } from 'react';
import { Outlet } from 'react-router';
import { RewardEffectsSlot } from '@/features/game/slots';
import { OnboardingGate } from '@/features/onboarding/slots';
import { Toaster } from '@/ui';
import { InstallPrompt } from './pwa/InstallPrompt';
import { UpdatePrompt } from './pwa/UpdatePrompt';

/** Things mounted once for the whole app, on every route. */
export function Root() {
  return (
    <>
      <Outlet />
      <Toaster />
      <UpdatePrompt />
      <InstallPrompt />
      <RewardEffectsSlot />
      <OnboardingGate />
    </>
  );
}

const UiGallery = lazy(() => import('./dev/UiGallery'));

/** Hidden design-system gallery (/dev/ui), loaded on demand. */
export function DevUiRoute() {
  return (
    <Suspense fallback={null}>
      <UiGallery />
    </Suspense>
  );
}
