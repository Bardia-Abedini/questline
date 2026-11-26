/**
 * Column types of every syncable table, 1:1 with `supabase/migrations`. OWNER: Cloud.
 *
 * The mapped types force every field of every row type to be listed, so adding a field to
 * `src/data/types.ts` without adding it here (and to a new migration) is a type error. A unit
 * test checks that the SQL migration declares exactly these columns.
 */
import type { SyncRow, SyncTableName, SyncTables } from '../types';

/**
 * - `uuid`, `text`, `bool`: as is.
 * - `int` (integer), `bigint` (milliseconds), `float` (double precision, e.g. positions).
 * - `ts`: timestamptz. Stored locally as ISO strings with milliseconds and `Z`.
 * - `date`: a `LocalDate` ("2026-03-10").
 * - `json`: jsonb (arrays and objects).
 */
export type ColumnType =
  'uuid' | 'text' | 'bool' | 'int' | 'bigint' | 'float' | 'ts' | 'date' | 'json';

type Columns<T> = { [K in keyof T]-?: ColumnType };

const SYNC_COLUMNS: Columns<SyncRow> = {
  id: 'uuid',
  user_id: 'uuid',
  created_at: 'ts',
  updated_at: 'ts',
  deleted_at: 'ts',
};

function table<N extends SyncTableName>(
  columns: Columns<Omit<SyncTables[N], keyof SyncRow>>,
): Columns<SyncTables[N]> {
  return { ...SYNC_COLUMNS, ...columns } as Columns<SyncTables[N]>;
}

export const TABLE_COLUMNS: { [N in SyncTableName]: Columns<SyncTables[N]> } = {
  quests: table<'quests'>({
    title: 'text',
    notes: 'text',
    status: 'text',
    priority: 'text',
    difficulty: 'text',
    guess_minutes: 'int',
    due_date: 'date',
    due_time: 'text',
    category_id: 'uuid',
    tag_ids: 'json',
    source: 'text',
    recurrence_rule_id: 'uuid',
    occurrence_date: 'date',
    template_id: 'uuid',
    is_boss: 'bool',
    boss_started_at: 'ts',
    activated_at: 'ts',
    completed_at: 'ts',
    archived_at: 'ts',
    last_touched_at: 'ts',
    overdue_asked_at: 'ts',
    overdue_answer: 'text',
    position: 'float',
  }),
  steps: table<'steps'>({
    quest_id: 'uuid',
    title: 'text',
    position: 'float',
    guess_minutes: 'int',
    quick: 'bool',
    quick_source: 'text',
    done_at: 'ts',
    actual_ms: 'bigint',
    completed_without_timer: 'bool',
    no_timer_confirmed: 'bool',
    no_timer_warned_at: 'ts',
  }),
  categories: table<'categories'>({
    name: 'text',
    name_key: 'text',
    color: 'text',
    icon: 'text',
    position: 'float',
  }),
  tags: table<'tags'>({ name: 'text', color: 'text' }),
  templates: table<'templates'>({
    title: 'text',
    notes: 'text',
    priority: 'text',
    difficulty: 'text',
    guess_minutes: 'int',
    category_id: 'uuid',
    tag_ids: 'json',
    steps: 'json',
  }),
  recurrence_rules: table<'recurrence_rules'>({
    kind: 'text',
    interval: 'int',
    weekdays: 'json',
    anchor_date: 'date',
    end_date: 'date',
    current_quest_id: 'uuid',
    current_occurrence_date: 'date',
    template: 'json',
    active: 'bool',
  }),
  focus_sessions: table<'focus_sessions'>({
    kind: 'text',
    quest_id: 'uuid',
    step_id: 'uuid',
    started_at: 'ts',
    planned_ms: 'bigint',
    pauses: 'json',
    away: 'json',
    distractions: 'json',
    ended_at: 'ts',
    end_reason: 'text',
    focused_ms: 'bigint',
    away_ms: 'bigint',
    paused_ms: 'bigint',
    double_xp: 'bool',
    device_id: 'text',
  }),
  distraction_notes: table<'distraction_notes'>({
    text: 'text',
    session_id: 'uuid',
    quest_id: 'uuid',
    step_id: 'uuid',
    captured_at: 'ts',
    inbox_quest_id: 'uuid',
  }),
  focus_blocks: table<'focus_blocks'>({
    quest_id: 'uuid',
    step_id: 'uuid',
    start_at: 'ts',
    end_at: 'ts',
  }),
  ledger_events: table<'ledger_events'>({
    kind: 'text',
    xp: 'int',
    gold: 'int',
    source_type: 'text',
    source_id: 'text',
    quest_id: 'uuid',
    dedupe_key: 'text',
    occurred_at: 'ts',
    day: 'date',
    meta: 'json',
  }),
  profile: table<'profile'>({
    display_name: 'text',
    avatar: 'json',
    cottage: 'json',
    title_id: 'text',
    friend_code: 'text',
    share_progress: 'bool',
    timezone: 'text',
    onboarded_at: 'ts',
  }),
  inventory: table<'inventory'>({
    kind: 'text',
    ref_id: 'text',
    source: 'text',
    acquired_at: 'ts',
    ledger_event_id: 'uuid',
    used_at: 'ts',
  }),
  user_rewards: table<'user_rewards'>({
    title: 'text',
    notes: 'text',
    price_gold: 'int',
    icon: 'text',
    archived_at: 'ts',
  }),
  power_up_activations: table<'power_up_activations'>({
    type: 'text',
    inventory_item_id: 'uuid',
    activated_at: 'ts',
    target_type: 'text',
    target_id: 'text',
  }),
  achievements: table<'achievements'>({ achievement_id: 'text', unlocked_at: 'ts' }),
  streak_state: table<'streak_state'>({ best: 'int' }),
  daily_quests: table<'daily_quests'>({
    day: 'date',
    slot: 'int',
    quest_key: 'text',
    kind: 'text',
    target: 'int',
    reward_gold: 'int',
    completed_at: 'ts',
    rewarded_at: 'ts',
    rerolled: 'bool',
  }),
  energy_checkins: table<'energy_checkins'>({ level: 'text', at: 'ts', day: 'date' }),
  settings: table<'settings'>({
    theme: 'text',
    language: 'text',
    text_size: 'text',
    font: 'text',
    motion: 'text',
    sound: 'bool',
    sound_volume: 'float',
    haptics: 'bool',
    active_limit: 'int',
    focus_minutes: 'int',
    break_minutes: 'int',
    focus_presets: 'json',
    away_threshold_seconds: 'int',
    idle_checkin_minutes: 'int',
    pledge_enabled: 'bool',
    ambience: 'text',
    ambience_volume: 'float',
    week_starts_on: 'int',
    ai_enabled: 'bool',
  }),
  notification_prefs: table<'notification_prefs'>({
    due_soon: 'bool',
    due_soon_minutes: 'int',
    daily_nudge: 'bool',
    daily_nudge_time: 'text',
    paused_reminder: 'bool',
    quiet_hours_enabled: 'bool',
    quiet_start: 'text',
    quiet_end: 'text',
    push_enabled: 'bool',
  }),
  calendar_links: table<'calendar_links'>({
    provider: 'text',
    entity_type: 'text',
    entity_id: 'uuid',
    external_calendar_id: 'text',
    external_event_id: 'text',
    etag: 'text',
    last_synced_at: 'ts',
  }),
  ai_usage: table<'ai_usage'>({
    kind: 'text',
    requested_at: 'ts',
    day: 'date',
    status: 'text',
  }),
};

/** Postgres type for each column type. */
export const SQL_TYPES: Record<ColumnType, string> = {
  uuid: 'uuid',
  text: 'text',
  bool: 'boolean',
  int: 'integer',
  bigint: 'bigint',
  float: 'double precision',
  ts: 'timestamptz',
  date: 'date',
  json: 'jsonb',
};

/**
 * Tables whose rows also have a natural key that is unique per user. Two devices can create
 * the "same" row offline with different ids; the server keeps the first and every device
 * converges on it.
 */
export const NATURAL_KEYS: Partial<Record<SyncTableName, string>> = {
  ledger_events: 'dedupe_key',
  achievements: 'achievement_id',
};

/** Append-only tables: never updated or deleted, on either side. */
export const APPEND_ONLY_TABLES: readonly SyncTableName[] = ['ledger_events'];
