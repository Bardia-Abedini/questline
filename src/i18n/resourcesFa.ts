/**
 * Persian translations, loaded on demand (see `loadLanguage` in ./index.ts) so English
 * players never download them. The service worker still precaches this chunk for offline use.
 */
import fa_common from './locales/fa/common.json';
import fa_settings from './locales/fa/settings.json';
import fa_dev from './locales/fa/dev.json';
import fa_today from './locales/fa/today.json';
import fa_quests from './locales/fa/quests.json';
import fa_focus from './locales/fa/focus.json';
import fa_game from './locales/fa/game.json';
import fa_cloud from './locales/fa/cloud.json';
import fa_stats from './locales/fa/stats.json';
import fa_insights from './locales/fa/insights.json';
import fa_onboarding from './locales/fa/onboarding.json';
import type { Resources } from './resources';

export const fa = {
  common: fa_common,
  settings: fa_settings,
  dev: fa_dev,
  today: fa_today,
  quests: fa_quests,
  focus: fa_focus,
  game: fa_game,
  cloud: fa_cloud,
  stats: fa_stats,
  insights: fa_insights,
  onboarding: fa_onboarding,
} satisfies Record<keyof Resources, object>;
