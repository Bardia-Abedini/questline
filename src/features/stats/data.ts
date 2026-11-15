import { useLiveQuery } from 'dexie-react-hooks';
import { db, useSettings, useToday } from '@/data';
import type { StatsInput } from './compute';

const alive = <T extends { deleted_at: string | null }>(rows: T[]) =>
  rows.filter((r) => r.deleted_at === null);

/** Everything the stats and the weekly recap read, live. `undefined` while loading. */
export function useStatsInput(): StatsInput | undefined {
  const today = useToday();
  const settings = useSettings();
  const rows = useLiveQuery(async () => {
    const [sessions, steps, quests, ledger, achievements] = await Promise.all([
      db.focus_sessions.toArray(),
      db.steps.toArray(),
      db.quests.where('status').equals('done').toArray(),
      db.ledger_events.toArray(),
      db.achievements.toArray(),
    ]);
    return {
      sessions: alive(sessions),
      steps: alive(steps),
      quests: alive(quests),
      ledger: alive(ledger),
      achievements: alive(achievements),
    };
  }, []);
  if (!rows || !settings) return undefined;
  return { today, weekStartsOn: settings.week_starts_on, ...rows };
}
