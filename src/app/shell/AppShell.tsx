import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';
import { ActiveSessionSlot } from '@/features/focus/slots';
import { OverduePromptSlot } from '@/features/quests/slots';
import { RouteErrorBoundary } from '../ErrorBoundary';
import { Header } from './Header';
import { BottomTabBar, SideBar } from './NavBar';

/** The app chrome: side bar (desktop) or bottom tab bar (phone), header, and the page. */
export function AppShell() {
  const { t } = useTranslation('common');
  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:shadow-md"
      >
        {t('skip_to_content')}
      </a>
      <SideBar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main
          id="main"
          tabIndex={-1}
          className="flex-1 px-4 pb-[calc(var(--ql-tabbar-h)+env(safe-area-inset-bottom)+1.5rem)] pt-5 outline-none sm:px-6 md:pb-10 md:pt-8"
        >
          <ActiveSessionSlot />
          <RouteErrorBoundary>
            <Outlet />
          </RouteErrorBoundary>
        </main>
      </div>
      <BottomTabBar />
      <OverduePromptSlot />
    </div>
  );
}

/** Full-screen pages (focus mode, onboarding): no header, no navigation. */
export function FullscreenLayout() {
  return (
    <div className="min-h-dvh" data-layout="fullscreen">
      <RouteErrorBoundary>
        <Outlet />
      </RouteErrorBoundary>
    </div>
  );
}
