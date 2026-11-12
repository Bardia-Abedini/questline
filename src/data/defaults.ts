import { DEFAULT_ACTIVE_LIMIT } from '@/domain/quests';
import type {
  Category,
  LanguagePref,
  NewRow,
  NotificationPrefs,
  Profile,
  Settings,
  StreakState,
} from './types';

export function defaultSettings(language: LanguagePref = 'en'): NewRow<Settings> {
  return {
    theme: 'system',
    language,
    text_size: 'normal',
    font: 'default',
    motion: 'system',
    sound: true,
    sound_volume: 0.7,
    haptics: true,
    active_limit: DEFAULT_ACTIVE_LIMIT,
    focus_minutes: 25,
    break_minutes: 5,
    focus_presets: [10, 15, 25, 45],
    away_threshold_seconds: 60,
    idle_checkin_minutes: 10,
    pledge_enabled: false,
    ambience: 'none',
    ambience_volume: 0.5,
    week_starts_on: language === 'fa' ? 6 : 1,
    ai_enabled: true,
  };
}

/** All off by default except due-soon (plan section 12). */
export function defaultNotificationPrefs(): NewRow<NotificationPrefs> {
  return {
    due_soon: true,
    due_soon_minutes: 60,
    daily_nudge: false,
    daily_nudge_time: '09:00',
    paused_reminder: false,
    quiet_hours_enabled: false,
    quiet_start: '22:00',
    quiet_end: '08:00',
    push_enabled: false,
  };
}

export function defaultProfile(timezone: string): NewRow<Profile> {
  return {
    display_name: '',
    avatar: {
      skin: 'skin_3',
      hair: 'hair_short',
      hair_color: 'chestnut',
      outfit: 'outfit_tunic',
      hat: null,
      accessory: null,
    },
    cottage: { slots: {}, pet: null, wallpaper: null, floor: null },
    title_id: null,
    friend_code: null,
    share_progress: false,
    timezone,
    onboarded_at: null,
  };
}

export function defaultStreakState(): NewRow<StreakState> {
  return { protected_days: [], best: 0 };
}

/** Built-in categories (plan: School, Home, Personal). Names come from i18n until renamed. */
export function defaultCategories(): NewRow<Category>[] {
  return [
    { name: '', name_key: 'school', color: 'sky', icon: 'book', position: 1 },
    { name: '', name_key: 'home', color: 'sage', icon: 'home', position: 2 },
    { name: '', name_key: 'personal', color: 'rose', icon: 'heart', position: 3 },
  ];
}
