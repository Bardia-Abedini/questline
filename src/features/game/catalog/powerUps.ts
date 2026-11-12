import type { PowerUpType } from '@/data/types';
import type { IconName } from '@/ui';

export interface PowerUpDef {
  type: PowerUpType;
  price: number;
  icon: IconName;
  /** i18n keys in `game`: `powerups.<type>.name` / `.description`. */
}

export const POWER_UPS: readonly PowerUpDef[] = Object.freeze([
  { type: 'lucky_charm', price: 40, icon: 'leaf' },
  { type: 'double_xp_potion', price: 30, icon: 'potion' },
  { type: 'daily_reroll', price: 15, icon: 'refresh' },
]);

export function powerUpDef(type: PowerUpType): PowerUpDef {
  return POWER_UPS.find((p) => p.type === type)!;
}
