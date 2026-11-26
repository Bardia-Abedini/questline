import type { FeatureRoutes } from '@/app/routing';
import { ArtSheetRoute } from './dev/ArtSheetRoute';
import { LazyHomePage, LazyShopPage } from './LazyPages';

/** OWNER: Game package. Home and Shop load on demand (see LazyPages.tsx). */
export const routes: FeatureRoutes = {
  shell: [
    { path: 'home', element: <LazyHomePage /> },
    { path: 'shop', element: <LazyShopPage /> },
  ],
  fullscreen: [{ path: 'dev/art', element: <ArtSheetRoute /> }],
};
