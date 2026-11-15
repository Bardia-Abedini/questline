/**
 * Keeps the player's "Questline" Google calendar in step with their data while connected:
 * quests with a due date and planned focus blocks become events; edits, completions (✓),
 * archiving and deletions follow. It reacts to data changes (including quest events, which
 * always change rows), and runs on any device: event ids are deterministic, so two devices
 * writing the same quest update one event.
 */
import { liveQuery, type Subscription } from 'dexie';
import { calendarLinksRepo, clock, db, getSingleton, type CalendarLink } from '@/data';
import { zonedTime } from '../../../../supabase/functions/_shared/reminders.ts';
import type { EventInput } from '../../../../supabase/functions/_shared/calendar.ts';
import { useCloud } from '../store';
import {
  deleteEvent,
  handleCalendarError,
  refreshCalendarStatus,
  upsertEvent,
  useCalendar,
} from './api';

const linkKey = (type: string, id: string) => `${type}:${id}`;

async function saveLink(
  entityType: CalendarLink['entity_type'],
  entityId: string,
  r: { calendarId: string; eventId: string; etag: string | null },
) {
  const patch = {
    provider: 'google' as const,
    entity_type: entityType,
    entity_id: entityId,
    external_calendar_id: r.calendarId,
    external_event_id: r.eventId,
    etag: r.etag,
    last_synced_at: clock.iso(),
  };
  // One link per entity on every device: the link id is the entity id.
  const existing = await calendarLinksRepo.getAny(entityId);
  if (!existing) await calendarLinksRepo.create({ id: entityId, ...patch });
  else {
    if (existing.deleted_at) await calendarLinksRepo.restore(entityId);
    await calendarLinksRepo.update(entityId, patch);
  }
}

let running = false;
let again = false;

/** One pass over quests and focus blocks. Exposed for tests. */
export async function reconcileCalendar(): Promise<void> {
  if (running) {
    again = true;
    return;
  }
  running = true;
  try {
    const timezone = (await getSingleton('profile'))?.timezone ?? 'UTC';
    const links = new Map(
      (await db.calendar_links.toArray())
        .filter((l) => l.deleted_at === null)
        .map((l) => [linkKey(l.entity_type, l.entity_id), l]),
    );
    const stale = (updatedAt: string, link?: CalendarLink) =>
      !link || !link.last_synced_at || updatedAt > link.last_synced_at;

    for (const q of await db.quests.toArray()) {
      const link = links.get(linkKey('quest', q.id));
      const wanted = q.deleted_at === null && q.due_date !== null && q.status !== 'archived';
      if (wanted && stale(q.updated_at, link)) {
        const event: EventInput = {
          type: 'quest',
          entityId: q.id,
          title: q.title,
          notes: q.notes,
          done: q.status === 'done',
          timezone,
          ...(q.due_time
            ? (() => {
                const due = zonedTime(q.due_date!, q.due_time, timezone);
                return {
                  start: new Date(due - 30 * 60_000).toISOString(),
                  end: new Date(due).toISOString(),
                };
              })()
            : { date: q.due_date! }),
        };
        await saveLink('quest', q.id, await upsertEvent(event));
      } else if (!wanted && link) {
        await deleteEvent('quest', q.id);
        await calendarLinksRepo.remove(link.id);
      }
    }

    const quests = new Map((await db.quests.toArray()).map((q) => [q.id, q]));
    for (const b of await db.focus_blocks.toArray()) {
      const link = links.get(linkKey('focus_block', b.id));
      const wanted = b.deleted_at === null;
      if (wanted && stale(b.updated_at, link)) {
        const title = (b.quest_id && quests.get(b.quest_id)?.title) || 'Focus';
        await saveLink(
          'focus_block',
          b.id,
          await upsertEvent({
            type: 'focus_block',
            entityId: b.id,
            title: `⏳ ${title}`,
            start: b.start_at,
            end: b.end_at,
            timezone,
          }),
        );
      } else if (!wanted && link) {
        await deleteEvent('focus_block', b.id);
        await calendarLinksRepo.remove(link.id);
      }
    }
  } catch (error) {
    handleCalendarError(error);
  } finally {
    running = false;
    if (again) {
      again = false;
      void reconcileCalendar();
    }
  }
}

export function startCalendarFollower(): () => void {
  let sub: Subscription | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const stopWatching = () => {
    sub?.unsubscribe();
    sub = null;
    if (timer) clearTimeout(timer);
  };
  const watch = () => {
    if (sub) return;
    sub = liveQuery(() =>
      Promise.all([
        db.quests.count(),
        db.quests.orderBy('updated_at').last(),
        db.focus_blocks.orderBy('updated_at').last(),
        db.focus_blocks.count(),
      ]),
    ).subscribe({
      next: () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => void reconcileCalendar(), 2000);
      },
      error: () => undefined,
    });
  };

  const offCalendar = useCalendar.subscribe((s) =>
    s.status === 'connected' ? watch() : stopWatching(),
  );
  const offCloud = useCloud.subscribe((s, prev) => {
    if (s.connected && !prev.connected) void refreshCalendarStatus();
    if (!s.connected && prev.connected) useCalendar.setState({ status: 'unknown', email: null });
  });
  return () => {
    offCalendar();
    offCloud();
    stopWatching();
  };
}
