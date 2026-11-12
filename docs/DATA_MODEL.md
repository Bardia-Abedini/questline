# Data model

The local database is IndexedDB through Dexie (`src/data/db.ts`, database name
`questline`). Row types are in `src/data/types.ts`. The Cloud package mirrors every
syncable table in Postgres with the same names and columns.

## Conventions

- **Names**: snake_case tables and columns, 1:1 with the future Postgres schema.
- **Ids**: UUID v4 strings (`newId()`).
- **Timestamps**: ISO 8601 UTC strings (`clock.iso()`), e.g. `2026-03-10T09:15:00.000Z`.
- **Days**: `LocalDate` strings `YYYY-MM-DD` in the user's time zone (`clock.today()`).
- **Wall-clock times**: `LocalTime` strings `HH:mm`.
- **Sync columns on every syncable row**:

| Column       | Type              | Meaning                                                                           |
| ------------ | ----------------- | --------------------------------------------------------------------------------- |
| `id`         | uuid              | Primary key                                                                       |
| `user_id`    | uuid or null      | Owner; null for guest rows. Cloud fills it on sign-up/upload.                     |
| `created_at` | timestamp         | Set once by the repository                                                        |
| `updated_at` | timestamp         | Bumped by every repository write; drives pull-by-`updated_at` and last-write-wins |
| `deleted_at` | timestamp or null | Soft delete. Never hard-delete synced rows.                                       |

- **Outbox**: every repository write adds or updates one `outbox` entry for the row in the
  same transaction.
- **Indexes**: IndexedDB does not index `null`, so "alive" (`deleted_at === null`) is a
  filter. Every syncable table indexes `updated_at`.
- **Schema changes**: add a new `this.version(n + 1)` in `db.ts` (never edit a shipped
  version) and update this file.

## Quests and steps

### `quests`

Indexes: `status, category_id, *tag_ids, due_date, recurrence_rule_id, template_id`.

| Field                | Type                                                                                                 | Notes                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `title`              | string                                                                                               |                                                                       |
| `notes`              | string                                                                                               | Empty string when none                                                |
| `status`             | `inbox` / `backlog` / `active` / `done` / `archived`                                                 |                                                                       |
| `priority`           | `high` / `medium` / `low`                                                                            | Active ordering                                                       |
| `difficulty`         | `E` `D` `C` `B` `A` `S`                                                                              | Reward size                                                           |
| `guess_minutes`      | number or null                                                                                       | Whole-quest time guess                                                |
| `due_date`           | LocalDate or null                                                                                    |                                                                       |
| `due_time`           | LocalTime or null                                                                                    | Without it the quest is due at the end of the day                     |
| `category_id`        | uuid or null                                                                                         | `categories.id`                                                       |
| `tag_ids`            | uuid[]                                                                                               | `tags.id`, multi-entry index                                          |
| `source`             | `manual` / `quick_capture` / `brain_dump` / `template` / `recurrence` / `distraction` / `onboarding` | How it was created                                                    |
| `recurrence_rule_id` | uuid or null                                                                                         | Series this is an occurrence of                                       |
| `occurrence_date`    | LocalDate or null                                                                                    | Day this occurrence is for                                            |
| `template_id`        | uuid or null                                                                                         | Template it came from                                                 |
| `is_boss`            | boolean                                                                                              | Boss quest                                                            |
| `boss_started_at`    | timestamp or null                                                                                    | When it became a boss                                                 |
| `activated_at`       | timestamp or null                                                                                    | Last time it became active                                            |
| `completed_at`       | timestamp or null                                                                                    |                                                                       |
| `archived_at`        | timestamp or null                                                                                    |                                                                       |
| `last_touched_at`    | timestamp or null                                                                                    | Any meaningful interaction; ordering and boss eligibility             |
| `overdue_asked_at`   | timestamp or null                                                                                    | The one "Can this still be done?" prompt was shown; never asked again |
| `overdue_answer`     | `keep` / `archive` / null                                                                            |                                                                       |
| `position`           | number                                                                                               | Manual order inside a list (fractional)                               |

### `steps`

Indexes: `quest_id, [quest_id+position], done_at`.

| Field                     | Type                   | Notes                                               |
| ------------------------- | ---------------------- | --------------------------------------------------- |
| `quest_id`                | uuid                   |                                                     |
| `title`                   | string                 |                                                     |
| `position`                | number                 | Order within the quest (fractional)                 |
| `guess_minutes`           | number or null         |                                                     |
| `quick`                   | boolean                | Can be done without a timer                         |
| `quick_source`            | `rule` / `ai` / `user` | Who set `quick` (rule: guess <= 5 min)              |
| `done_at`                 | timestamp or null      | Set only through `completeStep`                     |
| `actual_ms`               | number                 | Focused time on this step (Focus adds session time) |
| `completed_without_timer` | boolean                | Confirmed the one-time warning                      |
| `no_timer_warned_at`      | timestamp or null      | When that warning was shown                         |

### `categories`

| Field      | Type           | Notes                                                                                            |
| ---------- | -------------- | ------------------------------------------------------------------------------------------------ |
| `name`     | string         | Empty for untouched defaults                                                                     |
| `name_key` | string or null | `school` / `home` / `personal` for built-ins (translated in UI)                                  |
| `color`    | string         | Token suffix: `sky`, `sage`, `rose`, `honey`, `lavender`, `clay`, `teal`, `slate` (`--ql-cat-*`) |
| `icon`     | string         | Icon name from `src/ui/icons.tsx`                                                                |
| `position` | number         |                                                                                                  |

Defaults are seeded once per database by `ensureLocalData()`.

### `tags`

`name` (string), `color` (token suffix or null).

### `templates`

`title`, `notes`, `priority`, `difficulty`, `guess_minutes`, `category_id`, `tag_ids`,
`steps` (array of `{ title, guess_minutes, quick }`).

### `recurrence_rules`

| Field                     | Type                                             | Notes                                               |
| ------------------------- | ------------------------------------------------ | --------------------------------------------------- |
| `kind`                    | `daily` / `weekly` / `weekdays` / `every_n_days` |                                                     |
| `interval`                | number                                           | N for every N days / every N weeks                  |
| `weekdays`                | number[]                                         | 0 = Sunday ... 6 = Saturday                         |
| `anchor_date`             | LocalDate                                        | Series start; weekly repeats on its weekday         |
| `end_date`                | LocalDate or null                                | Inclusive                                           |
| `current_quest_id`        | uuid or null                                     | The one open occurrence                             |
| `current_occurrence_date` | LocalDate or null                                |                                                     |
| `template`                | object                                           | Template fields plus `due_time` for new occurrences |
| `active`                  | boolean                                          |                                                     |

Next dates come from `planNextOccurrence` in `src/domain/recurrence.ts`.

## Focus

### `focus_sessions`

Indexes: `quest_id, step_id, started_at, ended_at`.

| Field                                | Type                                                                             | Notes                                                     |
| ------------------------------------ | -------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `kind`                               | `focus` / `break`                                                                |                                                           |
| `quest_id`, `step_id`                | uuid or null                                                                     |                                                           |
| `started_at`                         | timestamp                                                                        | The timer is computed from this, never counted in memory  |
| `planned_ms`                         | number                                                                           |                                                           |
| `pauses`                             | `{ start, end \| null }[]`                                                       | Open pause = paused now                                   |
| `away`                               | `{ start, end \| null }[]`                                                       | App hidden/unfocused; never penalized                     |
| `distractions`                       | `{ at, kind: button / left_app / idle, note_id }[]`                              | Distraction events                                        |
| `ended_at`                           | timestamp or null                                                                | null = session still open (restore on reopen, any device) |
| `end_reason`                         | `timer_done` / `step_done` / `stopped` / `ended_while_away` / `abandoned` / null |                                                           |
| `focused_ms`, `away_ms`, `paused_ms` | number                                                                           | Filled in when the session ends (domain timer math)       |
| `double_xp`                          | boolean                                                                          | Double-XP potion active                                   |
| `device_id`                          | string                                                                           | Device that started it (`getDeviceId()`)                  |

### `distraction_notes`

`text`, `session_id`, `quest_id`, `step_id`, `captured_at`, `inbox_quest_id` (the Inbox
quest created from the note, if any).

### `focus_blocks`

Planned focus blocks for the calendar: `quest_id`, `step_id`, `start_at`, `end_at`.

## Economy

### `ledger_events` (append-only)

Indexes: `&dedupe_key` (unique), `kind, source_id, quest_id, day, occurred_at`.

| Field         | Type                                                                                                                                                                 | Notes                                                                                                                                                    |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kind`        | `step_reward` / `quest_finish` / `boss_bonus` / `focus_bonus` / `loot_gold` / `level_up_gift` / `daily_quest` / `achievement` / `purchase` / `refund` / `adjustment` |                                                                                                                                                          |
| `xp`          | number                                                                                                                                                               | Signed (never negative in practice)                                                                                                                      |
| `gold`        | number                                                                                                                                                               | Signed; purchases are negative                                                                                                                           |
| `source_type` | `step` / `quest` / `focus_session` / `daily_quest` / `level` / `achievement` / `shop_item` / `user_reward` / `system`                                                |                                                                                                                                                          |
| `source_id`   | string or null                                                                                                                                                       | Id of the source (step id, quest id, level number...)                                                                                                    |
| `quest_id`    | uuid or null                                                                                                                                                         | Quest the reward belongs to                                                                                                                              |
| `dedupe_key`  | string                                                                                                                                                               | Idempotency: `step:<id>`, `loot:step:<id>`, `quest:<id>`, `boss:<id>`, `focus:<session id>`, `daily:<id>`, `level:<n>`, `achievement:<id>`, purchase ids |
| `occurred_at` | timestamp                                                                                                                                                            |                                                                                                                                                          |
| `day`         | LocalDate                                                                                                                                                            | Streaks, daily stats, weekly XP                                                                                                                          |
| `meta`        | object or null                                                                                                                                                       | e.g. `{ double_xp: true }`                                                                                                                               |

Rows are never updated or deleted (the repository rejects it). Totals are sums: lifetime
XP = sum of `xp`; gold balance = sum of `gold`; level = `levelFromXp(xp)`; active days
(streak) = distinct `day` of `step_reward` rows; weekly XP = `xpInWeek(weekStart)`. Sync
merge is conflict-free: union of rows, skipping a row whose `dedupe_key` already exists.

### `inventory`

One row per owned unit. `kind` (`cosmetic` / `power_up` / `user_reward`), `ref_id` (catalog
id or `user_rewards.id`), `source` (`purchase` / `loot` / `milestone` / `achievement` /
`gift`), `acquired_at`, `ledger_event_id` (the purchase, if bought), `used_at` (power-up used
or real-life reward redeemed; null for cosmetics).

### `user_rewards`

Real-life rewards the player defines: `title`, `notes`, `price_gold`, `icon`, `archived_at`.

### `power_up_activations`

`type` (`streak_rest_token` / `double_xp_potion` / `daily_reroll`), `inventory_item_id`,
`activated_at`, `target_type` (`focus_session` / `day` / `daily_quest` / null), `target_id`.

### `achievements`

`achievement_id` (catalog id, unique), `unlocked_at`. The catalog lives in Game's code.

### `streak_state` (one row)

`protected_days` (LocalDate[] covered by rest tokens), `best` (best streak ever, kept even
if old rows are pruned). Current streak is derived (`computeStreak`).

### `daily_quests`

`day`, `slot` (0-2), `quest_key` (pool key), `kind`, `target`, `reward_gold`,
`completed_at`, `rewarded_at`, `rerolled`. Indexes: `day, [day+slot]`. Generate with
`generateDailyQuests(day, seed)` using a per-player seed so every device agrees.

### `energy_checkins`

`level` (`low` / `medium` / `high`), `at`, `day`.

## Profile and settings

### `profile` (one row)

| Field            | Type                                                             | Notes                                                       |
| ---------------- | ---------------------------------------------------------------- | ----------------------------------------------------------- |
| `display_name`   | string                                                           | Public name for future friends/parties                      |
| `avatar`         | `{ skin, hair, hair_color, outfit, hat, accessory }`             | Item ids (Game catalog)                                     |
| `cottage`        | `{ slots: { [slotId]: itemId \| null }, pet, wallpaper, floor }` |                                                             |
| `title_id`       | string or null                                                   | Equipped title                                              |
| `friend_code`    | string or null                                                   | Future: shareable code                                      |
| `share_progress` | boolean                                                          | Future: opt-in for leaderboards (weekly XP from the ledger) |
| `timezone`       | string                                                           | IANA zone                                                   |
| `onboarded_at`   | timestamp or null                                                |                                                             |

Level and cottage exterior tier are derived from XP (`levelFromXp`, `cottageTier`).

### `settings` (one row)

`theme` (`system`/`light`/`dark`), `language` (`en`/`fa`), `text_size`
(`normal`/`large`/`larger`), `font` (`default`/`dyslexic`), `motion`
(`system`/`reduce`/`full`), `sound`, `sound_volume` (0-1), `haptics`, `active_limit` (1-5,
default 3), `focus_minutes` (25), `break_minutes` (5), `focus_presets` ([10, 15, 25, 45]),
`away_threshold_seconds` (60), `idle_checkin_minutes` (10), `pledge_enabled` (false),
`ambience` (`none`/`rain`/`cafe`/`lofi`/`brown_noise`), `ambience_volume`,
`week_starts_on` (1 for English, 6 for Persian), `ai_enabled`.

The appearance fields are mirrored into the preferences store (`src/app/preferences`).

### `notification_prefs` (one row)

`due_soon` (true), `due_soon_minutes` (60), `daily_nudge` (false), `daily_nudge_time`,
`paused_reminder` (false), `quiet_hours_enabled`, `quiet_start`, `quiet_end`,
`push_enabled` (false). All off by default except due-soon.

## Integrations

### `calendar_links`

Maps a quest or focus block to a Google Calendar event: `provider` (`google`),
`entity_type` (`quest` / `focus_block`), `entity_id`, `external_calendar_id`,
`external_event_id`, `etag`, `last_synced_at`. Index `[entity_type+entity_id]`. Tokens
never live here; they stay server-side.

### `ai_usage`

Local mirror of AI calls: `kind` (`breakdown` / `stuck` / `suggest_fields` / `brain_dump` /
`what_now` / `classify`), `requested_at`, `day`, `status` (`ok` / `error` / `limited`). The
server is the authority on limits.

## Local-only tables (never synced)

### `outbox`

`seq` (auto-increment), `table`, `row_id` (unique together), `op` (`upsert` / `delete`),
`changed_at`, `attempts`, `last_error`. Sync engine contract: push in `seq` order, send the
row's current state, then delete the entry only if `changed_at` did not change meanwhile.

### `local_meta`

Key/value for this browser: `device_id`, `seeded_v1`, and anything the sync engine needs
(cursors). Use `localMeta.get/set/remove`.
