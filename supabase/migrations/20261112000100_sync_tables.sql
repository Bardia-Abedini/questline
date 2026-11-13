-- Questline: one table per syncable Dexie table (docs/DATA_MODEL.md), same names and columns.
--
-- Every table has the sync columns (id, user_id, created_at, updated_at, deleted_at) plus a
-- server-only column `server_updated_at`, the pull cursor: it is set from the server clock on
-- every write, so pulls never depend on device clocks. `updated_at` stays the edit time used
-- for last-write-wins (corrected for device clock skew by public.sync_push).
--
-- The column list must match src/data/sync/columns.ts (a unit test checks it).

create table public.quests (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  title text,
  notes text,
  status text,
  priority text,
  difficulty text,
  guess_minutes integer,
  due_date date,
  due_time text,
  category_id uuid,
  tag_ids jsonb,
  source text,
  recurrence_rule_id uuid,
  occurrence_date date,
  template_id uuid,
  is_boss boolean,
  boss_started_at timestamptz,
  activated_at timestamptz,
  completed_at timestamptz,
  archived_at timestamptz,
  last_touched_at timestamptz,
  overdue_asked_at timestamptz,
  overdue_answer text,
  "position" double precision,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table public.steps (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  quest_id uuid,
  title text,
  "position" double precision,
  guess_minutes integer,
  quick boolean,
  quick_source text,
  done_at timestamptz,
  actual_ms bigint,
  completed_without_timer boolean,
  no_timer_confirmed boolean,
  no_timer_warned_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table public.categories (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  name text,
  name_key text,
  color text,
  icon text,
  "position" double precision,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table public.tags (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  name text,
  color text,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table public.templates (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  title text,
  notes text,
  priority text,
  difficulty text,
  guess_minutes integer,
  category_id uuid,
  tag_ids jsonb,
  steps jsonb,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table public.recurrence_rules (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  kind text,
  "interval" integer,
  weekdays jsonb,
  anchor_date date,
  end_date date,
  current_quest_id uuid,
  current_occurrence_date date,
  template jsonb,
  active boolean,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table public.focus_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  kind text,
  quest_id uuid,
  step_id uuid,
  started_at timestamptz,
  planned_ms bigint,
  pauses jsonb,
  away jsonb,
  distractions jsonb,
  ended_at timestamptz,
  end_reason text,
  focused_ms bigint,
  away_ms bigint,
  paused_ms bigint,
  double_xp boolean,
  device_id text,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table public.distraction_notes (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  text text,
  session_id uuid,
  quest_id uuid,
  step_id uuid,
  captured_at timestamptz,
  inbox_quest_id uuid,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table public.focus_blocks (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  quest_id uuid,
  step_id uuid,
  start_at timestamptz,
  end_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table public.ledger_events (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  kind text,
  xp integer,
  gold integer,
  source_type text,
  source_id text,
  quest_id uuid,
  dedupe_key text,
  occurred_at timestamptz,
  day date,
  meta jsonb,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table public.profile (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  display_name text,
  avatar jsonb,
  cottage jsonb,
  title_id text,
  friend_code text,
  share_progress boolean,
  timezone text,
  onboarded_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table public.inventory (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  kind text,
  ref_id text,
  source text,
  acquired_at timestamptz,
  ledger_event_id uuid,
  used_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table public.user_rewards (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  title text,
  notes text,
  price_gold integer,
  icon text,
  archived_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table public.power_up_activations (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  type text,
  inventory_item_id uuid,
  activated_at timestamptz,
  target_type text,
  target_id text,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table public.achievements (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  achievement_id text,
  unlocked_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table public.streak_state (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  best integer,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table public.daily_quests (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  day date,
  slot integer,
  quest_key text,
  kind text,
  target integer,
  reward_gold integer,
  completed_at timestamptz,
  rewarded_at timestamptz,
  rerolled boolean,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table public.energy_checkins (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  level text,
  at timestamptz,
  day date,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table public.settings (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  theme text,
  language text,
  text_size text,
  font text,
  motion text,
  sound boolean,
  sound_volume double precision,
  haptics boolean,
  active_limit integer,
  focus_minutes integer,
  break_minutes integer,
  focus_presets jsonb,
  away_threshold_seconds integer,
  idle_checkin_minutes integer,
  pledge_enabled boolean,
  ambience text,
  ambience_volume double precision,
  week_starts_on integer,
  ai_enabled boolean,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table public.notification_prefs (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  due_soon boolean,
  due_soon_minutes integer,
  daily_nudge boolean,
  daily_nudge_time text,
  paused_reminder boolean,
  quiet_hours_enabled boolean,
  quiet_start text,
  quiet_end text,
  push_enabled boolean,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table public.calendar_links (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  provider text,
  entity_type text,
  entity_id uuid,
  external_calendar_id text,
  external_event_id text,
  etag text,
  last_synced_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table public.ai_usage (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  kind text,
  requested_at timestamptz,
  day date,
  status text,
  server_updated_at timestamptz not null default clock_timestamp()
);


