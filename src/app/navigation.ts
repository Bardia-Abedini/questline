import type { IconName } from '@/ui';
import { PATHS } from './routing';

export interface NavItem {
  key: 'today' | 'quests' | 'home' | 'shop' | 'stats' | 'settings';
  to: string;
  icon: IconName;
}

/** The six main destinations, in order (plan section 2). Labels: `common:nav.<key>`. */
export const NAV_ITEMS: readonly NavItem[] = [
  { key: 'today', to: PATHS.today, icon: 'today' },
  { key: 'quests', to: PATHS.quests, icon: 'quests' },
  { key: 'home', to: PATHS.home, icon: 'home' },
  { key: 'shop', to: PATHS.shop, icon: 'shop' },
  { key: 'stats', to: PATHS.stats, icon: 'stats' },
  { key: 'settings', to: PATHS.settings, icon: 'settings' },
];
