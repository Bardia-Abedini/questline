/**
 * Energy check-in (plan section 13): one tap, low / medium / high. The latest check-in is
 * "current" for a few hours of the same day, then the Today board asks again, gently.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import {
  clock,
  db,
  energyCheckinsRepo,
  toMs,
  useNow,
  useToday,
  writeTransaction,
  type EnergyCheckin,
  type EnergyLevel,
} from '@/data';
import { HOUR_MS, MINUTE_MS } from '@/domain/dates';
import { events } from '@/services';

/** How long a check-in counts as "how I feel now". */
export const ENERGY_FRESH_MS = 4 * HOUR_MS;
/** Changing your mind within this window edits the last check-in instead of adding one. */
export const ENERGY_EDIT_WINDOW_MS = 15 * MINUTE_MS;

/** The check-in that still describes now, or null (none today, or older than 4 hours). */
export function currentEnergy(
  latest: Pick<EnergyCheckin, 'level' | 'at' | 'day'> | null | undefined,
  now: number,
  today: string,
): EnergyLevel | null {
  if (!latest || latest.day !== today) return null;
  const age = now - toMs(latest.at);
  return age >= 0 && age < ENERGY_FRESH_MS ? latest.level : null;
}

async function latestToday(day: string): Promise<EnergyCheckin | null> {
  const rows = (await db.energy_checkins.where('day').equals(day).toArray()).filter(
    (r) => r.deleted_at === null,
  );
  rows.sort((a, b) => (a.at < b.at ? 1 : -1));
  return rows[0] ?? null;
}

/** Saves a check-in and tells other packages (`energy.checked_in`). */
export async function checkInEnergy(level: EnergyLevel): Promise<EnergyCheckin> {
  return writeTransaction(['energy_checkins'], async () => {
    const day = clock.today();
    const now = clock.now();
    const last = await latestToday(day);
    let row: EnergyCheckin;
    if (last && now - toMs(last.at) < ENERGY_EDIT_WINDOW_MS) {
      row = last.level === level ? last : await energyCheckinsRepo.update(last.id, { level });
    } else {
      row = await energyCheckinsRepo.create({ level, at: clock.iso(), day });
    }
    events.emitAfterCommit('energy.checked_in', { level });
    return row;
  });
}

/**
 * The current energy level, or null. `undefined` while loading. Re-evaluated every minute
 * so an old check-in quietly expires.
 */
export function useCurrentEnergy(): EnergyLevel | null | undefined {
  const today = useToday();
  const now = useNow(60_000);
  const latest = useLiveQuery(() => latestToday(today), [today]);
  if (latest === undefined) return undefined;
  return currentEnergy(latest, Math.max(now, clock.now()), today);
}
