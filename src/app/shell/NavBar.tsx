import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';
import { cx, Icon } from '@/ui';
import { NAV_ITEMS } from '../navigation';

/** Bottom tab bar on phones. */
export function BottomTabBar() {
  const { t } = useTranslation('common');
  return (
    <nav
      aria-label={t('nav.label')}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto grid h-[var(--ql-tabbar-h)] max-w-xl grid-cols-6">
        {NAV_ITEMS.map((item) => (
          <li key={item.key} className="min-w-0">
            <NavLink
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cx(
                  'group flex h-full flex-col items-center justify-center gap-0.5 px-0.5 text-[11px] in-data-[font=dyslexic]:text-[10px] font-bold transition-colors',
                  isActive ? 'text-primary' : 'text-muted hover:text-text',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cx(
                      'grid h-8 w-12 place-items-center rounded-full transition-colors duration-200',
                      isActive && 'bg-primary-soft',
                    )}
                  >
                    <Icon name={item.icon} size={22} />
                  </span>
                  <span className="max-w-full whitespace-nowrap">{t(`nav.${item.key}`)}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Side bar on tablets and desktops. */
export function SideBar() {
  const { t } = useTranslation('common');
  return (
    <aside className="sticky top-0 hidden h-dvh w-[var(--ql-sidebar-w)] shrink-0 flex-col gap-6 border-e border-border bg-surface/70 px-4 py-6 md:flex">
      <div className="flex items-center gap-2.5 px-2">
        <img src="/favicon.svg" alt="" width={36} height={36} className="rounded-md" />
        <span className="font-display text-2xl font-semibold text-text">{t('app_name')}</span>
      </div>
      <nav aria-label={t('nav.label')}>
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <li key={item.key}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cx(
                    'flex min-h-11 items-center gap-3 rounded-lg px-3 font-bold transition-colors duration-150',
                    isActive
                      ? 'bg-primary-soft text-text shadow-sm'
                      : 'text-muted hover:bg-surface-2 hover:text-text',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      name={item.icon}
                      size={22}
                      className={isActive ? 'text-primary' : undefined}
                    />
                    {t(`nav.${item.key}`)}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <p className="mt-auto px-2 text-sm text-faint">{t('tagline')}</p>
    </aside>
  );
}
