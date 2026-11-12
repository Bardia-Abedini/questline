/**
 * Runs once at app start, after the database is ready. OWNER: Focus.
 * Example: restore an open session, watch page visibility for time away.
 * Return a cleanup function if you subscribe to anything.
 */
export function setup(): (() => void) | void {}
