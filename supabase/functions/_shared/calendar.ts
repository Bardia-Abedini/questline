/**
 * Google Calendar helpers that need no network: deterministic event ids, event bodies and
 * day ranges. Shared by the `calendar` function and the app's tests.
 */

export type CalendarEntity = 'quest' | 'focus_block';

/**
 * A stable Google event id for a quest or focus block, so every device writes the same event
 * (Google ids use base32hex: a-v and 0-9; a UUID's hex digits qualify).
 */
export function eventIdFor(type: CalendarEntity, entityId: string): string {
  const hex = entityId.toLowerCase().replace(/[^0-9a-f]/g, '');
  return `ql${type === 'quest' ? 'q' : 'b'}${hex}`;
}

export interface EventInput {
  type: CalendarEntity;
  entityId: string;
  title: string;
  notes?: string;
  /** All-day event on this LocalDate (quests without a due time). */
  date?: string;
  /** Timed event (ISO instants). */
  start?: string;
  end?: string;
  done?: boolean;
  timezone?: string;
}

export function validEventInput(v: unknown): EventInput | null {
  const e = v as Partial<EventInput> | null;
  if (!e || (e.type !== 'quest' && e.type !== 'focus_block')) return null;
  if (typeof e.entityId !== 'string' || !/^[0-9a-f-]{36}$/i.test(e.entityId)) return null;
  if (typeof e.title !== 'string' || e.title.length === 0 || e.title.length > 300) return null;
  const isDate = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const isInstant = (s: unknown) => typeof s === 'string' && !Number.isNaN(Date.parse(s));
  if (e.date !== undefined && !isDate(e.date)) return null;
  if (e.date === undefined && !(isInstant(e.start) && isInstant(e.end))) return null;
  if (e.notes !== undefined && (typeof e.notes !== 'string' || e.notes.length > 2000)) return null;
  return e as EventInput;
}

/** The Google Calendar event resource for a quest or focus block. */
export function eventBody(e: EventInput): Record<string, unknown> {
  const nextDay = (d: string) => {
    const [y, m, day] = d.split('-').map(Number) as [number, number, number];
    return new Date(Date.UTC(y, m - 1, day + 1)).toISOString().slice(0, 10);
  };
  return {
    id: eventIdFor(e.type, e.entityId),
    summary: `${e.done ? '✓ ' : ''}${e.title}`,
    description: e.notes ?? '',
    ...(e.date
      ? { start: { date: e.date }, end: { date: nextDay(e.date) } }
      : {
          start: { dateTime: e.start, ...(e.timezone ? { timeZone: e.timezone } : {}) },
          end: { dateTime: e.end, ...(e.timezone ? { timeZone: e.timezone } : {}) },
        }),
    transparency: e.type === 'quest' ? 'transparent' : 'opaque',
    extendedProperties: { private: { questline: e.type, entityId: e.entityId } },
    reminders: { useDefault: false },
  };
}

export interface DayEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
}

/** Google event list items as simple day events (busy times only, cancelled ones skipped). */
export function toDayEvents(items: unknown[]): DayEvent[] {
  const out: DayEvent[] = [];
  for (const raw of items) {
    const it = raw as {
      id?: string;
      status?: string;
      summary?: string;
      transparency?: string;
      start?: { date?: string; dateTime?: string };
      end?: { date?: string; dateTime?: string };
    };
    if (!it.id || it.status === 'cancelled') continue;
    const allDay = !!it.start?.date;
    const start = it.start?.dateTime ?? it.start?.date;
    const end = it.end?.dateTime ?? it.end?.date;
    if (!start || !end) continue;
    out.push({ id: it.id, title: it.summary ?? '', start, end, allDay });
  }
  return out;
}
