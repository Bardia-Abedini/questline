import type { FeatureRoutes } from '@/app/routing';
import { ArtSheetRoute } from './dev/ArtSheetRoute';
import { HomePage } from './HomePage';
import { ShopPage } from './ShopPage';

/** OWNER: Game package. */
export const routes: FeatureRoutes = {
  shell: [
    { path: 'home', element: <HomePage /> },
    { path: 'shop', element: <ShopPage /> },
  ],
  fullscreen: [{ path: 'dev/art', element: <ArtSheetRoute /> }],
};
