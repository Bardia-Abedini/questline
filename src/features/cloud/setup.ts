/**
 * Runs once at app start, after the database is ready. OWNER: Cloud.
 * Restores the session and starts sync when signed in; starts in-app reminders and the
 * calendar follower. With no configuration only the local reminders run.
 */
import { refreshAiStatus } from './aiClient';
import { startCalendarFollower } from './calendar/follower';
import { startReminders } from './reminders/runner';
import { startCloud } from './session';
import { useCloud } from './store';

export function setup(): () => void {
  const cleanups: Array<() => void> = [];
  let stopped = false;
  void startCloud().then((stop) => (stopped ? stop() : cleanups.push(stop)));
  cleanups.push(
    useCloud.subscribe((s, prev) => {
      if (s.connected && !prev.connected) void refreshAiStatus();
    }),
  );
  cleanups.push(startReminders());
  cleanups.push(startCalendarFollower());
  return () => {
    stopped = true;
    cleanups.forEach((c) => c());
  };
}
