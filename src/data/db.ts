import Dexie, { type EntityTable, type Table } from 'dexie';
import type {
  AchievementUnlock,
  AiUsage,
  CalendarLink,
  Category,
  DailyQuest,
  DistractionNote,
  EnergyCheckin,
  FocusBlock,
  FocusSession,
  InventoryItem,
  LedgerEvent,
  LocalMeta,
  NotificationPrefs,
  OutboxEntry,
  PowerUpActivation,
  Profile,
  Quest,
  QuestTemplate,
  RecurrenceRule,
  Settings,
  Step,
  StreakState,
  SyncTableName,
  Tag,
  UserReward,
} from './types';

export const DB_NAME = 'questline';

/**
 * The local database. One Dexie table per entity; see docs/DATA_MODEL.md.
 *
 * Schema changes: never edit an existing `version(n)` block once it has shipped. Add a new
 * `this.version(n + 1).stores({...})` with only the changed tables (and an `.upgrade()` if
 * rows need migrating), and update docs/DATA_MODEL.md. Only the Foundation owner and the
 * Cloud package change this file; other packages ask for schema changes in their report.
 *
 * Indexes: IndexedDB does not index `null`, so "not deleted" is a filter, not an index.
 * Every syncable table indexes `updated_at` for the sync engine's pull/push.
 */
export class QuestlineDB extends Dexie {
  quests!: EntityTable<Quest, 'id'>;
  steps!: EntityTable<Step, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  tags!: EntityTable<Tag, 'id'>;
  templates!: EntityTable<QuestTemplate, 'id'>;
  recurrence_rules!: EntityTable<RecurrenceRule, 'id'>;
  focus_sessions!: EntityTable<FocusSession, 'id'>;
  distraction_notes!: EntityTable<DistractionNote, 'id'>;
  focus_blocks!: EntityTable<FocusBlock, 'id'>;
  ledger_events!: EntityTable<LedgerEvent, 'id'>;
  profile!: EntityTable<Profile, 'id'>;
  inventory!: EntityTable<InventoryItem, 'id'>;
  user_rewards!: EntityTable<UserReward, 'id'>;
  power_up_activations!: EntityTable<PowerUpActivation, 'id'>;
  achievements!: EntityTable<AchievementUnlock, 'id'>;
  streak_state!: EntityTable<StreakState, 'id'>;
  daily_quests!: EntityTable<DailyQuest, 'id'>;
  energy_checkins!: EntityTable<EnergyCheckin, 'id'>;
  settings!: EntityTable<Settings, 'id'>;
  notification_prefs!: EntityTable<NotificationPrefs, 'id'>;
  calendar_links!: EntityTable<CalendarLink, 'id'>;
  ai_usage!: EntityTable<AiUsage, 'id'>;
  outbox!: Table<OutboxEntry, number>;
  local_meta!: EntityTable<LocalMeta, 'key'>;

  constructor(name = DB_NAME) {
    super(name);
    this.version(1).stores({
      quests:
        'id, status, category_id, *tag_ids, due_date, recurrence_rule_id, template_id, updated_at',
      steps: 'id, quest_id, [quest_id+position], done_at, updated_at',
      categories: 'id, position, updated_at',
      tags: 'id, name, updated_at',
      templates: 'id, updated_at',
      recurrence_rules: 'id, current_quest_id, updated_at',
      focus_sessions: 'id, quest_id, step_id, started_at, ended_at, updated_at',
      distraction_notes: 'id, session_id, captured_at, updated_at',
      focus_blocks: 'id, quest_id, start_at, updated_at',
      ledger_events: 'id, &dedupe_key, kind, source_id, quest_id, day, occurred_at, updated_at',
      profile: 'id, updated_at',
      inventory: 'id, kind, ref_id, updated_at',
      user_rewards: 'id, updated_at',
      power_up_activations: 'id, type, target_id, updated_at',
      achievements: 'id, &achievement_id, updated_at',
      streak_state: 'id, updated_at',
      daily_quests: 'id, day, [day+slot], updated_at',
      energy_checkins: 'id, day, at, updated_at',
      settings: 'id, updated_at',
      notification_prefs: 'id, updated_at',
      calendar_links: 'id, [entity_type+entity_id], updated_at',
      ai_usage: 'id, day, updated_at',
      outbox: '++seq, &[table+row_id], table',
      local_meta: 'key',
    });
  }
}

/** All syncable table names, in a stable order. */
export const SYNC_TABLES: readonly SyncTableName[] = [
  'quests',
  'steps',
  'categories',
  'tags',
  'templates',
  'recurrence_rules',
  'focus_sessions',
  'distraction_notes',
  'focus_blocks',
  'ledger_events',
  'profile',
  'inventory',
  'user_rewards',
  'power_up_activations',
  'achievements',
  'streak_state',
  'daily_quests',
  'energy_checkins',
  'settings',
  'notification_prefs',
  'calendar_links',
  'ai_usage',
];

/** Tables that hold exactly one live row per player. */
export const SINGLETON_TABLES = [
  'profile',
  'settings',
  'streak_state',
  'notification_prefs',
] as const;
export type SingletonTableName = (typeof SINGLETON_TABLES)[number];

export const db = new QuestlineDB();
