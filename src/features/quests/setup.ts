import { clock } from '@/data';
import { events } from '@/services';
import { rollRecurrences } from './model/recurrence';

/** How often to check whether the day changed (recurring quests move on at midnight). */
const DAY_CHECK_MS = 60_000;

/**
 * Runs once at app start, after the database is ready. OWNER: Quests.
 * Keeps recurring quests up to date: on start, when a day passes, and when an occurrence
 * is finished or archived.
 */
export function setup(): () => void {
  let lastDay = clock.today();
  const roll = () => void rollRecurrences(clock.today());
  roll();

  const offCompleted = events.on('quest.completed', (e) => {
    if (e.recurring) roll();
  });
  const offArchived = events.on('quest.archived', roll);
  const timer = window.setInterval(() => {
    const today = clock.today();
    if (today !== lastDay) {
      lastDay = today;
      roll();
    }
  }, DAY_CHECK_MS);

  return () => {
    offCompleted();
    offArchived();
    window.clearInterval(timer);
  };
}
