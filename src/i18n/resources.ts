/**
 * Bundled translations: English only (it is also the fallback). Persian lives in
 * ./resourcesFa.ts and is loaded on demand. One file per namespace per language (see config.ts NAMESPACES).
 * Foundation-owned: every namespace is already imported, so packages only edit their own JSON.
 */
import en_common from './locales/en/common.json';
import en_settings from './locales/en/settings.json';
import en_dev from './locales/en/dev.json';
import en_today from './locales/en/today.json';
import en_quests from './locales/en/quests.json';
import en_focus from './locales/en/focus.json';
import en_game from './locales/en/game.json';
import en_cloud from './locales/en/cloud.json';
import en_stats from './locales/en/stats.json';
import en_insights from './locales/en/insights.json';
import en_onboarding from './locales/en/onboarding.json';

export const resources = {
  en: {
    common: en_common,
    settings: en_settings,
    dev: en_dev,
    today: en_today,
    quests: en_quests,
    focus: en_focus,
    game: en_game,
    cloud: en_cloud,
    stats: en_stats,
    insights: en_insights,
    onboarding: en_onboarding,
  },
} as const;

/** English is the reference: its keys are the typed keys for `t()`. */
export type Resources = typeof resources.en;
