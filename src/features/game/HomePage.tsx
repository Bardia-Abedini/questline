import { useSearchParams } from 'react-router';
import { AvatarSvg } from '@/art/avatar/AvatarSvg';
import { usePlayerStats } from '@/data';
import { useFormat } from '@/i18n/useFormat';
import { Card, Chip, Icon, Page, Tabs } from '@/ui';
import { DEFAULT_TITLE, titleById } from './catalog/titles';
import { AchievementsPanel } from './home/AchievementsPanel';
import { AdventurerPanel } from './home/AdventurerPanel';
import { CottagePanel } from './home/CottagePanel';
import { useGameT, useLooks } from './ui/hooks';

type HomeTab = 'cottage' | 'adventurer' | 'achievements';
const TABS: HomeTab[] = ['cottage', 'adventurer', 'achievements'];

/** Avatar, cottage and badges. OWNER: Game. */
export function HomePage() {
  const { t, tx } = useGameT();
  const { number } = useFormat();
  const { profile, look } = useLooks();
  const stats = usePlayerStats();
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const tab: HomeTab = TABS.includes(raw as HomeTab) ? (raw as HomeTab) : 'cottage';
  const title = titleById(profile?.title_id ?? DEFAULT_TITLE);
  const streak = stats?.streak;
  const level = stats?.level.level ?? 1;

  const streakLine =
    !streak || streak.status === 'new'
      ? t('home.streak_new')
      : streak.status === 'active'
        ? t('home.streak_active')
        : t('home.streak_resting');

  return (
    <Page title={t('home.title')} subtitle={t('home.subtitle')}>
      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <AvatarSvg variant="portrait" size={88} look={look} />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="truncate text-xl font-extrabold" data-testid="home-name">
              {profile?.display_name || t('home.name_placeholder')}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="xp" size="sm" icon="sparkle">
                {t('home.level', { level: number(level) })}
              </Chip>
              {title && (
                <Chip tone="gold" size="sm" icon="star" data-testid="home-title">
                  {tx(title.nameKey)}
                </Chip>
              )}
            </div>
          </div>
        </div>
        <div
          className="flex min-w-0 items-center gap-3 rounded-lg bg-surface-2 p-3 sm:max-w-xs"
          data-testid="home-streak"
          data-status={streak?.status ?? 'new'}
        >
          <span
            className={
              streak?.status === 'active'
                ? 'grid size-11 shrink-0 place-items-center rounded-full bg-primary-soft text-streak'
                : 'grid size-11 shrink-0 place-items-center rounded-full bg-surface-3 text-muted'
            }
          >
            <Icon name={streak?.status === 'resting' ? 'moon' : 'flame'} filled size={24} />
          </span>
          <div className="min-w-0">
            <p className="font-bold">
              {t('home.streak_title')}:{' '}
              {t('home.streak_value', {
                count: streak?.current ?? 0,
                formatted: number(streak?.current ?? 0),
              })}
            </p>
            <p className="text-sm text-muted">{streakLine}</p>
            <p className="text-xs text-faint">
              {t('home.streak_best', { best: number(streak?.best ?? 0) })}
            </p>
          </div>
        </div>
      </Card>

      <Tabs
        label={t('home.tabs_label')}
        value={tab}
        onChange={(v) => setParams({ tab: v }, { replace: true })}
        items={[
          {
            value: 'cottage',
            label: t('home.tab_cottage'),
            content: <CottagePanel />,
          },
          {
            value: 'adventurer',
            label: t('home.tab_adventurer'),
            content: <AdventurerPanel />,
          },
          {
            value: 'achievements',
            label: t('home.tab_achievements'),
            content: <AchievementsPanel />,
          },
        ]}
      />
    </Page>
  );
}
