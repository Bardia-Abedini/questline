/**
 * Runs once at app start, after the database is ready. OWNER: Cloud.
 * Example: restore the Supabase session, start the sync engine when signed in.
 * Return a cleanup function if you subscribe to anything.
 */
export function setup(): (() => void) | void {}
