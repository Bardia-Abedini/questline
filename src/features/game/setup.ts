/**
 * Runs once at app start, after the database is ready. OWNER: Game.
 * Example: configureRewards({ rareItemIds }), listen to `step.completed` for achievements.
 * Return a cleanup function if you subscribe to anything.
 */
export function setup(): (() => void) | void {}
