import { lazy, Suspense } from 'react';

const ArtSheet = lazy(() => import('./ArtSheet'));

/** Hidden art review sheet (/dev/art), loaded on demand. Not linked from the app. */
export function ArtSheetRoute() {
  return (
    <Suspense fallback={null}>
      <ArtSheet />
    </Suspense>
  );
}
