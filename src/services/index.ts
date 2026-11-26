/**
 * Service layer: the shared operations every package uses.
 * - events: typed event bus between packages
 * - rewards: the only way to pay XP/gold (grantReward) and to spend gold (spendGold)
 * - progress: completing and reopening steps and quests
 */
export * from './events';
export * from './rewards';
export * from './progress';
export { useAppEvent } from './useAppEvent';
