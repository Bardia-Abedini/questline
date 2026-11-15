import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db, useToday } from '@/data';
import { useFormat } from '@/i18n/useFormat';
import { Card, Chip, cx, Icon, ProgressBar, Section, showToast } from '@/ui';
import {
  dayActivity,
  defFor,
  ensureDailyQuests,
  listDailyQuests,
  rerollDaily,
} from '../logic/dailyQuests';
import { unusedPowerUps } from '../logic/powerUps';
import { dailyQuestProgress } from '@/domain/dailyQuests';
import { enqueue, scheduleRefresh } from '../setup';
import { useGameT } from './hooks';

/** Today's three optional goals with progress, gold and a swap button (reroll power-up). */
export function DailyQuests() {
  const { t, tx } = useGameT();
  const { number } = useFormat();
  const today = useToday();
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void enqueue(() => ensureDailyQuests(today)).then(() => scheduleRefresh(50));
  }, [today]);

  const data = useLiveQuery(async () => {
    const rows = await listDailyQuests(today);
    const activity = await dayActivity(today);
    const rerolls = (await unusedPowerUps('daily_reroll')).length;
    // Touch the tables progress depends on so the query re-runs when they change.
    await db.ledger_events.count();
    return { rows, activity, rerolls };
  }, [today]);

  const rows = data?.rows ?? [];

  const swap = async (id: string, goal: string) => {
    setBusy(id);
    try {
      await rerollDaily(id);
      showToast({ title: t('daily.rerolled'), tone: 'success', icon: 'refresh' });
      scheduleRefresh(50);
    } catch {
      showToast({ title: t('daily.reroll_none'), description: goal, tone: 'info' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Section title={t('daily.title')} description={t('daily.subtitle')}>
      {rows.length === 0 ? (
        <Card tone="sunken" className="text-muted">
          {t('daily.loading')}
        </Card>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="daily-quests">
          {rows.map((row) => {
            const def = defFor(row) ?? {
              key: row.quest_key,
              kind: row.kind,
              target: row.target,
              rewardGold: row.reward_gold,
            };
            const goal = tx(`daily.quests.${def.key}`);
            const p = dailyQuestProgress(
              { ...def, target: row.target },
              data?.activity ?? {
                stepsFinished: 0,
                quickStepsFinished: 0,
                focusMinutes: 0,
                focusSessions: 0,
                questsFinished: 0,
                energyCheckins: 0,
                inboxSorted: 0,
                oldQuestsTouched: 0,
              },
            );
            const done = !!row.rewarded_at || p.done;
            const current = done ? row.target : p.progress;
            return (
              <Card
                as="li"
                key={row.id}
                padding="sm"
                tone={done ? 'gold' : 'default'}
                className="flex items-center gap-3"
                data-testid="daily-quest"
                data-done={done ? 'true' : 'false'}
              >
                <span
                  aria-hidden
                  className={cx(
                    'grid size-10 shrink-0 place-items-center rounded-full',
                    done ? 'bg-gold text-on-primary' : 'bg-surface-2 text-muted',
                  )}
                >
                  <Icon name={done ? 'check' : 'sun'} size={20} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="min-w-0 font-bold">{goal}</p>
                    <Chip tone="gold" size="sm" icon="coin">
                      {t('daily.reward', { gold: number(row.reward_gold) })}
                    </Chip>
                    {done && (
                      <Chip tone="success" size="sm">
                        {t('daily.done')}
                      </Chip>
                    )}
                  </div>
                  <ProgressBar
                    value={current}
                    max={row.target}
                    tone="gold"
                    size="xs"
                    label={goal}
                    valueText={t('daily.progress', {
                      current: number(current),
                      target: number(row.target),
                    })}
                  />
                  <p className="text-xs text-muted">
                    {t('daily.progress', { current: number(current), target: number(row.target) })}
                  </p>
                </div>
                {!done && (data?.rerolls ?? 0) > 0 && (
                  <button
                    type="button"
                    className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-md px-2 text-sm font-bold text-primary hover:bg-surface-2 disabled:opacity-50"
                    aria-label={t('daily.reroll_label', { goal })}
                    disabled={busy !== null}
                    onClick={() => void swap(row.id, goal)}
                  >
                    <Icon name="refresh" size={16} />
                    {t('daily.reroll')}
                  </button>
                )}
              </Card>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
