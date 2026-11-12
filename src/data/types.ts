/**
 * Row types for every table in the local database (Dexie / IndexedDB).
 *
 * Conventions (see docs/DATA_MODEL.md):
 * - Field names are snake_case so rows map 1:1 to the future Postgres tables.
 * - Timestamps are ISO 8601 UTC strings (`IsoDateTime`), e.g. "2026-03-10T09:15:00.000Z".
 * - Calendar days are `LocalDate` strings ("2026-03-10") in the user's time zone.
 * - Every syncable row has `id` (UUID v4), `user_id` (null for guests), `created_at`,
 *   `updated_at` and `deleted_at` (soft delete; null while alive).
 * - Never hard-delete a syncable row; set `deleted_at` through the repositories.
 */
import type { DailyQuestKind } from '@/domain/dailyQuests';
import type { LocalDate } from '@/domain/dates';
import type { RecurrenceKind } from '@/domain/recurrence';
import type { Difficulty, EnergyLevel, Priority, QuestStatus } from '@/domain/types';

export type { Difficulty, EnergyLevel, LocalDate, Priority, QuestStatus };

/** ISO 8601 UTC timestamp string, as produced by `Date.prototype.toISOString()`. */
export type IsoDateTime = string;
/** UUID v4 string. */
export type Uuid = string;
/** Wall-clock time `HH:mm` in the user's time zone. */
export type LocalTime = string;

/** Columns every syncable row carries. */
export interface SyncRow {
  id: Uuid;
  /** Owner. null while the player is a guest; filled in by the Cloud package on sign-up. */
  user_id: Uuid | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
  /** Soft delete. Rows with a value here are hidden by every repository read. */
  deleted_at: IsoDateTime | null;
}

/* ------------------------------------------------------------------ quests */

export type QuestSource =
  | 'manual'
  | 'quick_capture'
  | 'brain_dump'
  | 'template'
  | 'recurrence'
  | 'distraction'
  | 'onboarding';

export type OverdueAnswer = 'keep' | 'archive';

export interface Quest extends SyncRow {
  title: string;
  notes: string;
  status: QuestStatus;
  priority: Priority;
  difficulty: Difficulty;
  /** Whole-quest time guess in minutes. */
  guess_minutes: number | null;
  due_date: LocalDate | null;
  due_time: LocalTime | null;
  category_id: Uuid | null;
  /** Tag ids (multi-entry index). */
  tag_ids: Uuid[];
  source: QuestSource;
  /** Recurring series this quest is an occurrence of. */
  recurrence_rule_id: Uuid | null;
  /** The day this occurrence is for (recurring quests only). */
  occurrence_date: LocalDate | null;
  /** Template the quest was created from, if any. */
  template_id: Uuid | null;
  /** Boss quest (plan section 6). */
  is_boss: boolean;
  boss_started_at: IsoDateTime | null;
  /** When the quest last became active (used to show "started" order). */
  activated_at: IsoDateTime | null;
  completed_at: IsoDateTime | null;
  archived_at: IsoDateTime | null;
  /** Any meaningful interaction: step done, session, edit, activation. Drives ordering and boss eligibility. */
  last_touched_at: IsoDateTime | null;
  /** Set when the single "Can this still be done?" prompt was shown. Never asked again. */
  overdue_asked_at: IsoDateTime | null;
  overdue_answer: OverdueAnswer | null;
  /** Manual sort position within its status list (fractional). */
  position: number;
}

export type QuickSource = 'rule' | 'ai' | 'user';

export interface Step extends SyncRow {
  quest_id: Uuid;
  title: string;
  /** Order within the quest (fractional, so inserting between two steps needs no renumbering). */
  position: number;
  guess_minutes: number | null;
  /** Can be done without a timer (plan section 4). */
  quick: boolean;
  quick_source: QuickSource;
  done_at: IsoDateTime | null;
  /** Focused time spent on this step, summed from sessions (ms). */
  actual_ms: number;
  /**
   * Fact: the step was checked off with no focus session (quick steps included).
   * Stats use it to tell timed from untimed completions.
   */
  completed_without_timer: boolean;
  /** The player confirmed the one-time "did you really finish it?" warning (non-quick steps only). */
  no_timer_confirmed: boolean;
  /** When the one-time "did you really finish it?" warning was shown. */
  no_timer_warned_at: IsoDateTime | null;
}

export interface Category extends SyncRow {
  /** User-facing name. Empty for untouched defaults, which show `name_key` translated. */
  name: string;
  /** i18n key for built-in categories ("school", "home", "personal"); null for user-made ones. */
  name_key: string | null;
  /** Design-token color name, e.g. "sage" (see src/ui/tokens.css `--ql-cat-*`). */
  color: string;
  /** Icon name from src/ui/icons. */
  icon: string;
  position: number;
}

export interface Tag extends SyncRow {
  name: string;
  color: string | null;
}

export interface TemplateStep {
  title: string;
  guess_minutes: number | null;
  quick: boolean;
}

export interface QuestTemplate extends SyncRow {
  title: string;
  notes: string;
  priority: Priority;
  difficulty: Difficulty;
  guess_minutes: number | null;
  category_id: Uuid | null;
  tag_ids: Uuid[];
  steps: TemplateStep[];
}

export interface RecurrenceRule extends SyncRow {
  kind: RecurrenceKind;
  /** Every N days / every N weeks. */
  interval: number;
  /** 0 = Sunday ... 6 = Saturday, for `weekdays`. */
  weekdays: number[];
  anchor_date: LocalDate;
  end_date: LocalDate | null;
  /** The currently open occurrence (one at a time, so missed ones never pile up). */
  current_quest_id: Uuid | null;
  current_occurrence_date: LocalDate | null;
  /** What each new occurrence looks like. */
  template: Omit<QuestTemplate, keyof SyncRow> & { due_time: LocalTime | null };
  active: boolean;
}

/* ------------------------------------------------------------------- focus */

export type SessionKind = 'focus' | 'break';
export type SessionEndReason =
  'timer_done' | 'step_done' | 'stopped' | 'ended_while_away' | 'abandoned';

export interface TimeSpanRow {
  start: IsoDateTime;
  end: IsoDateTime | null;
}

export type DistractionKind = 'button' | 'left_app' | 'idle';

export interface DistractionEvent {
  at: IsoDateTime;
  kind: DistractionKind;
  /** The note parked from the "I got distracted" button, if any. */
  note_id: Uuid | null;
}

export interface FocusSession extends SyncRow {
  kind: SessionKind;
  quest_id: Uuid | null;
  step_id: Uuid | null;
  started_at: IsoDateTime;
  planned_ms: number;
  pauses: TimeSpanRow[];
  /** Periods the app was hidden or unfocused. Never penalized. */
  away: TimeSpanRow[];
  distractions: DistractionEvent[];
  ended_at: IsoDateTime | null;
  end_reason: SessionEndReason | null;
  /** Filled in when the session ends (from src/domain/timer). */
  focused_ms: number;
  away_ms: number;
  paused_ms: number;
  /** A double-XP potion was active for this session. */
  double_xp: boolean;
  /** Device that started it, to tell "this device" from "another device" when restoring. */
  device_id: string;
}

export interface DistractionNote extends SyncRow {
  text: string;
  session_id: Uuid | null;
  quest_id: Uuid | null;
  step_id: Uuid | null;
  captured_at: IsoDateTime;
  /** The Inbox quest created from it, if any. */
  inbox_quest_id: Uuid | null;
}

/** A focus block planned in a calendar gap (plan section 11). */
export interface FocusBlock extends SyncRow {
  quest_id: Uuid | null;
  step_id: Uuid | null;
  start_at: IsoDateTime;
  end_at: IsoDateTime;
}

/* ------------------------------------------------------------------ ledger */

export type LedgerKind =
  | 'step_reward'
  | 'quest_finish'
  | 'boss_bonus'
  | 'focus_bonus'
  | 'loot_gold'
  | 'level_up_gift'
  | 'daily_quest'
  | 'achievement'
  | 'purchase'
  | 'refund'
  | 'adjustment';

export type LedgerSourceType =
  | 'step'
  | 'quest'
  | 'focus_session'
  | 'daily_quest'
  | 'level'
  | 'achievement'
  | 'shop_item'
  | 'user_reward'
  | 'system';

/**
 * One reward or spend. Append-only: never updated or deleted. XP and gold totals, level,
 * weekly XP and streak days are all derived from this table.
 */
export interface LedgerEvent extends SyncRow {
  kind: LedgerKind;
  /** Signed. XP is never negative in practice. */
  xp: number;
  /** Signed. Purchases are negative. */
  gold: number;
  source_type: LedgerSourceType;
  source_id: string | null;
  /** The quest this reward belongs to, if any (step rewards, finish, boss, loot on steps). */
  quest_id: Uuid | null;
  /**
   * Idempotency key, unique per user, e.g. "step:<id>", "quest:<id>", "level:7".
   * A reward with an existing key is never granted twice (also across devices after sync).
   */
  dedupe_key: string;
  occurred_at: IsoDateTime;
  /** Local day it happened, for streaks, daily stats and weekly XP. */
  day: LocalDate;
  meta: Record<string, unknown> | null;
}

/* ----------------------------------------------------------------- profile */

export interface AvatarConfig {
  /** Item or variant ids per slot; null = none. Art lives in src/art. */
  skin: string;
  hair: string | null;
  hair_color: string | null;
  outfit: string | null;
  hat: string | null;
  accessory: string | null;
}

export interface CottageConfig {
  /** Decoration slot id -> item id. */
  slots: Record<string, string | null>;
  pet: string | null;
  wallpaper: string | null;
  floor: string | null;
}

export interface Profile extends SyncRow {
  /** Shown to friends later; defaults to empty (UI shows a translated placeholder). */
  display_name: string;
  avatar: AvatarConfig;
  cottage: CottageConfig;
  /** Equipped title id (titles unlock from milestones and achievements). */
  title_id: string | null;
  /** For later social features: stable, shareable, unique code. null until first needed. */
  friend_code: string | null;
  /** Opt-in for later leaderboards. Weekly XP is derived from the ledger. */
  share_progress: boolean;
  /** IANA zone used to compute `LocalDate`s; updated when the device zone changes. */
  timezone: string;
  onboarded_at: IsoDateTime | null;
}

/* ---------------------------------------------------------- shop / economy */

export type InventoryKind = 'cosmetic' | 'power_up' | 'user_reward';
export type InventorySource = 'purchase' | 'loot' | 'milestone' | 'achievement' | 'gift';

/** One owned thing. Power-ups and user rewards are one row per unit. */
export interface InventoryItem extends SyncRow {
  kind: InventoryKind;
  /** Catalog item id (cosmetic, power-up) or a `user_rewards.id`. */
  ref_id: string;
  source: InventorySource;
  acquired_at: IsoDateTime;
  /** Ledger event that paid for it, if bought. */
  ledger_event_id: Uuid | null;
  /** Power-up used / real-life reward redeemed. Cosmetics keep null. */
  used_at: IsoDateTime | null;
}

export interface UserReward extends SyncRow {
  title: string;
  notes: string;
  price_gold: number;
  icon: string;
  archived_at: IsoDateTime | null;
}

/**
 * - `lucky_charm`: doubles the bonus-gold chance on step completion for 24 h from `activated_at`.
 * - `double_xp_potion`: doubles XP for one focus session (set `focus_sessions.double_xp`).
 * - `daily_reroll`: swaps one daily quest.
 */
export type PowerUpType = 'lucky_charm' | 'double_xp_potion' | 'daily_reroll';

/** A power-up being used: what it applied to. */
export interface PowerUpActivation extends SyncRow {
  type: PowerUpType;
  inventory_item_id: Uuid;
  activated_at: IsoDateTime;
  /** e.g. the session a potion doubles or the daily quest rerolled; null for a lucky charm. */
  target_type: 'focus_session' | 'daily_quest' | null;
  target_id: string | null;
}

export interface AchievementUnlock extends SyncRow {
  /** Catalog id, unique per user. */
  achievement_id: string;
  unlocked_at: IsoDateTime;
}

/**
 * Streak state. The streak itself is derived from active days in the ledger and never
 * resets, so `best` equals the current streak; it is stored so it survives pruning of old
 * ledger rows and is readable without scanning the ledger.
 */
export interface StreakState extends SyncRow {
  best: number;
}

export interface DailyQuest extends SyncRow {
  day: LocalDate;
  slot: number;
  /** Pool key, see src/domain/dailyQuests.ts. */
  quest_key: string;
  kind: DailyQuestKind;
  target: number;
  reward_gold: number;
  completed_at: IsoDateTime | null;
  /** Gold paid (ledger key "daily:<id>"). */
  rewarded_at: IsoDateTime | null;
  rerolled: boolean;
}

export interface EnergyCheckin extends SyncRow {
  level: EnergyLevel;
  at: IsoDateTime;
  day: LocalDate;
}

/* ---------------------------------------------------------------- settings */

export type ThemePref = 'system' | 'light' | 'dark';
export type LanguagePref = 'en' | 'fa';
export type TextSize = 'normal' | 'large' | 'larger';
export type FontPref = 'default' | 'dyslexic';
export type MotionPref = 'system' | 'reduce' | 'full';
export type AmbienceTrack = 'none' | 'rain' | 'cafe' | 'lofi' | 'brown_noise';

export interface Settings extends SyncRow {
  theme: ThemePref;
  language: LanguagePref;
  text_size: TextSize;
  font: FontPref;
  motion: MotionPref;
  sound: boolean;
  sound_volume: number;
  haptics: boolean;
  /** 1..5, default 3. */
  active_limit: number;
  focus_minutes: number;
  break_minutes: number;
  focus_presets: number[];
  /** Seconds away before the "left the app" nudge. */
  away_threshold_seconds: number;
  /** Minutes after the timer ended with no input before "Still on it?". */
  idle_checkin_minutes: number;
  pledge_enabled: boolean;
  ambience: AmbienceTrack;
  ambience_volume: number;
  /** 0 = Sunday, 1 = Monday, 6 = Saturday. */
  week_starts_on: number;
  ai_enabled: boolean;
}

export interface NotificationPrefs extends SyncRow {
  due_soon: boolean;
  due_soon_minutes: number;
  daily_nudge: boolean;
  daily_nudge_time: LocalTime;
  paused_reminder: boolean;
  quiet_hours_enabled: boolean;
  quiet_start: LocalTime;
  quiet_end: LocalTime;
  push_enabled: boolean;
}

/* ---------------------------------------------------- integrations / cloud */

export type CalendarEntityType = 'quest' | 'focus_block';

/** Maps a quest or focus block to an event in the user's "Questline" Google calendar. */
export interface CalendarLink extends SyncRow {
  provider: 'google';
  entity_type: CalendarEntityType;
  entity_id: Uuid;
  external_calendar_id: string;
  external_event_id: string;
  etag: string | null;
  last_synced_at: IsoDateTime | null;
}

export type AiRequestKind =
  'breakdown' | 'stuck' | 'suggest_fields' | 'brain_dump' | 'what_now' | 'classify';

/** Local mirror of AI requests. The server is the authority on limits. */
export interface AiUsage extends SyncRow {
  kind: AiRequestKind;
  requested_at: IsoDateTime;
  day: LocalDate;
  status: 'ok' | 'error' | 'limited';
}

/* ------------------------------------------------------------- local only */

export type OutboxOp = 'upsert' | 'delete';

/** A pending local change for the sync engine. Local only, never synced itself. */
export interface OutboxEntry {
  /** Auto-increment, gives push order. */
  seq?: number;
  table: SyncTableName;
  row_id: Uuid;
  op: OutboxOp;
  changed_at: IsoDateTime;
  attempts: number;
  last_error: string | null;
}

/** Device-local key/value store (device id, sync cursors, last seen time...). Never synced. */
export interface LocalMeta {
  key: string;
  value: unknown;
}

/* ------------------------------------------------------------- table map */

/** Every syncable table and its row type. */
export interface SyncTables {
  quests: Quest;
  steps: Step;
  categories: Category;
  tags: Tag;
  templates: QuestTemplate;
  recurrence_rules: RecurrenceRule;
  focus_sessions: FocusSession;
  distraction_notes: DistractionNote;
  focus_blocks: FocusBlock;
  ledger_events: LedgerEvent;
  profile: Profile;
  inventory: InventoryItem;
  user_rewards: UserReward;
  power_up_activations: PowerUpActivation;
  achievements: AchievementUnlock;
  streak_state: StreakState;
  daily_quests: DailyQuest;
  energy_checkins: EnergyCheckin;
  settings: Settings;
  notification_prefs: NotificationPrefs;
  calendar_links: CalendarLink;
  ai_usage: AiUsage;
}

export type SyncTableName = keyof SyncTables;

/** Fields a caller provides when creating a row; the repository fills the rest. */
export type NewRow<T extends SyncRow> = Omit<T, keyof SyncRow> & Partial<Pick<SyncRow, 'id'>>;
/** Fields a caller may change on update. */
export type RowPatch<T extends SyncRow> = Partial<Omit<T, keyof SyncRow>>;
