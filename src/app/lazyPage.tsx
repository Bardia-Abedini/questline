import { lazy, Suspense, type ComponentType } from 'react';
import { PageLoading } from './PageLoading';

/**
 * A route page loaded on first visit instead of at start-up (its code is still precached by
 * the service worker, so it opens instantly and offline). Use it in a feature's routes.tsx
 * with the route's `Component` property:
 *
 *   shell: [{ path: 'settings', Component: lazyPage(() => import('./SettingsPage'), 'SettingsPage') }]
 */
export function lazyPage<M extends Record<string, unknown>>(
  load: () => Promise<M>,
  name: keyof M & string,
): ComponentType {
  const Page = lazy(() => load().then((m) => ({ default: m[name] as ComponentType })));
  return function LazyPage() {
    return (
      <Suspense fallback={<PageLoading />}>
        <Page />
      </Suspense>
    );
  };
}
