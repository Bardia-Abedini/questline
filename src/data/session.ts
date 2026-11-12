/**
 * Who owns new rows. Guests write `user_id: null`. The Cloud package calls
 * `setCurrentUserId` after sign-in (and back to null after sign-out), and is responsible
 * for stamping existing guest rows with the new id when it uploads them.
 */
import type { Uuid } from './types';

let currentUserId: Uuid | null = null;

export function getCurrentUserId(): Uuid | null {
  return currentUserId;
}

export function setCurrentUserId(id: Uuid | null): void {
  currentUserId = id;
}
