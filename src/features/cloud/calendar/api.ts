import { create } from 'zustand';
import type { DayEvent, EventInput } from '../../../../supabase/functions/_shared/calendar.ts';
import { callFunction, FunctionError } from '../functions';

export type CalendarStatus = 'unknown' | 'unconfigured' | 'disconnected' | 'connected';

export const useCalendar = create<{ status: CalendarStatus; email: string | null }>(() => ({
  status: 'unknown',
  email: null,
}));

export async function refreshCalendarStatus(): Promise<CalendarStatus> {
  try {
    const r = await callFunction<{ configured: boolean; connected: boolean; email: string | null }>(
      'calendar',
      { action: 'status' },
    );
    const status: CalendarStatus = !r.configured
      ? 'unconfigured'
      : r.connected
        ? 'connected'
        : 'disconnected';
    useCalendar.setState({ status, email: r.email });
    return status;
  } catch (error) {
    // Not signed in, offline or not deployed: unknown for now (unconfigured if not deployed).
    const status: CalendarStatus =
      error instanceof FunctionError && error.code === 'failed' ? 'unconfigured' : 'unknown';
    useCalendar.setState({ status });
    return status;
  }
}

/** Sends the player to Google's consent screen; Google returns to /calendar. */
export async function connectCalendar(): Promise<void> {
  const r = await callFunction<{ url: string }>('calendar', {
    action: 'connect',
    returnTo: `${location.origin}/calendar`,
  });
  location.assign(r.url);
}

export async function disconnectCalendar(): Promise<void> {
  await callFunction('calendar', { action: 'disconnect' });
  useCalendar.setState({ status: 'disconnected', email: null });
}

export async function fetchDayEvents(timeMin: string, timeMax: string): Promise<DayEvent[]> {
  const r = await callFunction<{ events: DayEvent[] }>('calendar', {
    action: 'day',
    timeMin,
    timeMax,
  });
  return r.events;
}

export function upsertEvent(event: EventInput) {
  return callFunction<{ calendarId: string; eventId: string; etag: string | null }>('calendar', {
    action: 'upsert',
    event,
  });
}

export function deleteEvent(type: EventInput['type'], entityId: string) {
  return callFunction('calendar', { action: 'delete', type, entityId });
}

/** Marks the connection lost (access revoked in Google) so the UI asks to reconnect. */
export function handleCalendarError(error: unknown): void {
  if (
    error instanceof FunctionError &&
    (error.code === 'reconnect' || error.code === 'not_connected')
  ) {
    useCalendar.setState({ status: 'disconnected', email: null });
  }
}
