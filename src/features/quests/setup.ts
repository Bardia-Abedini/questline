/**
 * Runs once at app start, after the database is ready. OWNER: Quests.
 * Example: plan the next recurring occurrence on `quest.completed`.
 * Return a cleanup function if you subscribe to anything.
 */
export function setup(): (() => void) | void {}
