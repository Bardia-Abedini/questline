import { useEffect, useState } from 'react';
import { clock } from './clock';

/** The current time (epoch ms) from `clock`, refreshed every `intervalMs` (default 30 s). */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => clock.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(clock.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Today's local date; changes after midnight (checked every 30 s). */
export function useToday(): string {
  const [today, setToday] = useState(() => clock.today());
  useEffect(() => {
    const id = window.setInterval(() => setToday(clock.today()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return today;
}
