import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { usePlayerStats } from '@/data/hooks';
import { SyncStatusSlot } from '@/features/cloud/slots';
import { AvatarBadge } from '@/features/game/slots';
import { QuickCaptureSlot } from '@/features/quests/slots';
import { useFormat } from '@/i18n/useFormat';
import { cx, Icon, ProgressBar } from '@/ui';
import { PATHS } from '../routing';

/**
 * Slim header (plan section 2): avatar, level, XP bar, gold, streak. All values are
 * derived live from the reward ledger. Foundation-owned; packages plug in through slots.
 */
export function Header() {
  const { t } = useTranslation('common');
  const { number } = useFormat();
  const stats = usePlayerStats();
  const level = stats?.level.level ?? 1;
  const into = stats?.level.xpIntoLevel ?? 0;
  const need = stats?.level.xpForNext ?? 100;
  const gold = stats?.gold ?? 0;
  const streak = stats?.streak;
  const resting = streak?.status === 'resting';

  return (
    <header
      className="sticky top-0 z-30 border-b border-border/70 bg-bg/85 backdrop-blur-md"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div
        className="mx-auto flex h-[var(--ql-header-h)] w-full max-w-3xl items-center gap-3 px-4 sm:px-6"
        aria-label={t('header.status_label')}
        role="group"
      >
        <Link
          to={PATHS.home}
          className="shrink-0 rounded-full ring-2 ring-primary/25 transition-transform hover:scale-105"
        >
          <AvatarBadge size={38} />
        </Link>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-baseline gap-2 text-sm leading-none">
            <span className="whitespace-nowrap font-extrabold text-text" data-testid="header-level">
              {t('header.level', { level: number(level) })}
            </span>
            <span className="truncate text-xs text-muted">
              {t('header.xp_value', { current: number(into), total: number(need) })}
            </span>
          </div>
          <ProgressBar
            value={into}
            max={need}
            size="sm"
            label={t('header.xp')}
            valueText={t('header.xp_value', { current: number(into), total: number(need) })}
          />
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-full bg-gold-soft px-2 py-1 text-sm font-extrabold text-gold-text"
            title={t('header.gold')}
            data-testid="header-gold"
          >
            <Icon name="coin" className="text-gold" />
            <span className="ql-visually-hidden">{t('header.gold')}:</span>
            {number(gold)}
          </span>
          <span
            className={cx(
              'inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-extrabold',
              resting ? 'bg-surface-2 text-muted' : 'bg-primary-soft text-streak',
            )}
            title={resting ? t('header.streak_resting') : t('header.streak')}
            data-testid="header-streak"
          >
            <Icon name="flame" filled={!resting && (streak?.current ?? 0) > 0} />
            <span className="ql-visually-hidden">
              {t('header.streak_value', { count: streak?.current ?? 0 })}
              {resting ? ` (${t('header.streak_resting')})` : ''}
            </span>
            <span aria-hidden>{number(streak?.current ?? 0)}</span>
          </span>
          <SyncStatusSlot />
          <QuickCaptureSlot />
        </div>
      </div>
    </header>
  );
}
