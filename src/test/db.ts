import { db } from '@/data/db';
import { setClock } from '@/data/clock';
import { setCurrentUserId } from '@/data/session';
import { events } from '@/services/events';

/** Fresh empty database, real clock, guest user, no listeners. Call in beforeEach. */
export async function resetAll(): Promise<void> {
  events.clear();
  setClock(null);
  setCurrentUserId(null);
  db.close();
  await db.delete();
  await db.open();
}
