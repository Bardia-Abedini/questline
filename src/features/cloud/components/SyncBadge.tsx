import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { cx, Icon, showToast, type IconName } from '@/ui';
import { syncNow } from '../session';
import { useCloud } from '../store';

export type BadgeState = 'guest' | 'syncing' | 'synced' | 'offline' | 'error';

export function useBadgeState(): BadgeState {
  return useCloud((s) => {
    if (s.auth !== 'signed_in') return 'guest';
    if (!s.online) return 'offline';
    const sync = s.sync?.state;
    if (sync === 'error') return 'error';
    if (sync === 'offline') return 'offline';
    if (sync === 'synced' && (s.sync?.pending ?? 0) === 0) return 'synced';
    return 'syncing';
  });
}

const ICON: Record<BadgeState, IconName> = {
  guest: 'cloud',
  syncing: 'refresh',
  synced: 'cloud',
  offline: 'cloud',
  error: 'alert',
};

const DOT: Record<BadgeState, string> = {
  guest: 'bg-border-strong',
  syncing: 'bg-xp',
  synced: 'bg-success',
  offline: 'bg-border-strong',
  error: 'bg-warning',
};

/** Small, quiet sync indicator in the header. On error it is a retry button. */
export function SyncBadge() {
  const { t } = useTranslation('cloud');
  const state = useBadgeState();
  const label = t(`sync.state_${state}`);
  const className = cx(
    'relative inline-flex size-9 shrink-0 items-center justify-center rounded-full text-lg transition-colors hover:bg-surface-2',
    state === 'error' ? 'text-warning' : state === 'synced' ? 'text-primary' : 'text-muted',
  );
  const inner = (
    <>
      <Icon
        name={ICON[state]}
        className={cx(state === 'syncing' && 'motion-safe:animate-spin')}
        aria-hidden
      />
      <span
        aria-hidden
        className={cx('absolute bottom-1.5 end-1.5 size-2 rounded-full ring-2 ring-bg', DOT[state])}
      />
    </>
  );

  if (state === 'error') {
    return (
      <button
        type="button"
        className={className}
        aria-label={`${label}. ${t('sync.retry')}`}
        title={`${label}. ${t('sync.retry')}`}
        data-testid="sync-status"
        data-state={state}
        onClick={() => {
          void syncNow().then(() => {
            const after = useCloud.getState().sync?.state;
            if (after === 'synced')
              showToast({ tone: 'success', icon: 'cloud', title: t('sync.retried') });
          });
        }}
      >
        {inner}
      </button>
    );
  }
  return (
    <Link
      to="/account"
      className={className}
      aria-label={label}
      title={label}
      data-testid="sync-status"
      data-state={state}
    >
      {inner}
    </Link>
  );
}
