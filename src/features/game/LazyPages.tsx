import { lazy, Suspense, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Spinner } from '@/ui';

// Home and Shop carry the cottage and item art: loaded when first opened, not at start-up.
const HomePage = lazy(() => import('./HomePage').then((m) => ({ default: m.HomePage })));
const ShopPage = lazy(() => import('./ShopPage').then((m) => ({ default: m.ShopPage })));

function Loading({ children }: { children: ReactNode }) {
  const { t } = useTranslation('common');
  return (
    <Suspense
      fallback={
        <div className="grid place-items-center py-16">
          <Spinner label={t('loading')} />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

export function LazyHomePage() {
  return (
    <Loading>
      <HomePage />
    </Loading>
  );
}

export function LazyShopPage() {
  return (
    <Loading>
      <ShopPage />
    </Loading>
  );
}
