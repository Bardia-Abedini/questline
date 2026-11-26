import { useLiveQuery } from 'dexie-react-hooks';
import { useAchievements, db } from '@/data';
import { useFormat } from '@/i18n/useFormat';
import { Card, cx, ProgressBar } from '@/ui';
import { ACHIEVEMENTS, EMPTY_STATS } from '../catalog/achievements';
import { buildAchievementStats } from '../logic/achievements';
import { Badge } from '../ui/Badge';
import { useGameT } from '../ui/hooks';

/** The badge gallery. Locked badges show a gentle hint and progress, never a warning. */
export function AchievementsPanel() {
  const { t, tx } = useGameT();
  const { number, date } = useFormat();
  const unlocked = useAchievements();
  const stats =
    useLiveQuery(async () => {
      await db.ledger_events.count();
      return buildAchievementStats();
    }, []) ?? EMPTY_STATS;
  const byId = new Map((unlocked ?? []).map((a) => [a.achievement_id, a]));

  return (
    <div className="flex flex-col gap-3">
      <p className="font-bold text-muted" data-testid="achievements-summary">
        {t('achievements.summary', {
          n: number(byId.size),
          total: number(ACHIEVEMENTS.length),
        })}
      </p>
      <ul className="grid gap-2 sm:grid-cols-2" aria-label={t('achievements.title')}>
        {ACHIEVEMENTS.map((def) => {
          const row = byId.get(def.id);
          const p = def.progress(stats);
          const name = tx(`achievements.${def.id}.name`);
          return (
            <Card
              as="li"
              key={def.id}
              padding="sm"
              tone={row ? 'gold' : 'default'}
              className={cx('flex items-center gap-3', !row && 'bg-surface/70')}
              data-testid={`achievement-${def.id}`}
              data-unlocked={row ? 'true' : 'false'}
            >
              <Badge def={def} unlocked={!!row} size={52} />
              <div className="min-w-0 flex-1">
                <p className={cx('font-bold', !row && 'text-muted')}>{name}</p>
                <p className="text-sm text-muted">{tx(`achievements.${def.id}.hint`)}</p>
                {row ? (
                  <p className="text-xs font-bold text-gold-text">
                    {t('achievements.earned_on', { date: date(Date.parse(row.unlocked_at)) })}
                    {' · '}
                    {t('achievements.reward', { gold: number(def.gold) })}
                  </p>
                ) : (
                  p.target > 1 && (
                    <ProgressBar
                      className="mt-1"
                      size="xs"
                      tone="gold"
                      value={p.current}
                      max={p.target}
                      label={name}
                      valueText={t('achievements.progress', {
                        current: number(p.current),
                        target: number(p.target),
                      })}
                    >
                      <span className="text-xs text-faint">
                        {t('achievements.progress', {
                          current: number(p.current),
                          target: number(p.target),
                        })}
                      </span>
                    </ProgressBar>
                  )
                )}
              </div>
            </Card>
          );
        })}
      </ul>
    </div>
  );
}
