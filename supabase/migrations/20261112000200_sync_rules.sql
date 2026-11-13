-- Sync rules for every mirrored table: last-write-wins trigger, pull index, row-level security,
-- grants, the append-only ledger and realtime.

-- The syncable tables, in the client's order (src/data/db.ts SYNC_TABLES).
create or replace function public.sync_tables()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'quests', 'steps', 'categories', 'tags', 'templates', 'recurrence_rules',
    'focus_sessions', 'distraction_notes', 'focus_blocks', 'ledger_events', 'profile',
    'inventory', 'user_rewards', 'power_up_activations', 'achievements', 'streak_state',
    'daily_quests', 'energy_checkins', 'settings', 'notification_prefs', 'calendar_links',
    'ai_usage'
  ]::text[]
$$;

-- Server-side `updated_at` handling for last-write-wins:
-- * an edit time in the future (a device clock running fast) is clamped to the server clock,
--   so one bad clock cannot win every later conflict;
-- * an update older than the stored row is skipped (the newer write wins);
-- * an update that changes nothing is skipped (no churn for other devices);
-- * id, owner and created_at never change;
-- * server_updated_at (the pull cursor) always comes from the server clock.
create or replace function public.sync_row_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  server_now timestamptz := date_trunc('milliseconds', now());
begin
  if new.updated_at is null or new.updated_at > server_now then
    new.updated_at := server_now;
  end if;
  if new.created_at is null then
    new.created_at := new.updated_at;
  end if;
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.user_id := old.user_id;
    new.created_at := old.created_at;
    new.server_updated_at := old.server_updated_at;
    if new.updated_at < old.updated_at then
      return null;
    end if;
    if row(new.*) is not distinct from row(old.*) then
      return null;
    end if;
  end if;
  new.server_updated_at := clock_timestamp();
  return new;
end
$$;

-- The reward ledger is append-only on the server too. Rows are only ever removed together
-- with the whole account (or by an explicit "replace my account data" reset).
create or replace function public.ledger_events_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'ledger_events is append-only' using errcode = '42501';
  end if;
  if coalesce(current_setting('questline.allow_ledger_delete', true), '') = 'on'
     or not exists (select 1 from auth.users u where u.id = old.user_id) then
    return old;
  end if;
  raise exception 'ledger_events is append-only' using errcode = '42501';
end
$$;

create trigger ledger_events_append_only
  before update or delete on public.ledger_events
  for each row execute function public.ledger_events_append_only();

do $$
declare
  t text;
begin
  foreach t in array public.sync_tables() loop
    execute format(
      'create trigger sync_row_before_write before insert or update on public.%I
         for each row execute function public.sync_row_before_write()', t);
    -- Pull by server cursor, per user.
    execute format('create index %I on public.%I (user_id, server_updated_at, id)', t || '_pull_idx', t);

    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
    execute format(
      'create policy "Read own rows" on public.%I for select to authenticated
         using (user_id = (select auth.uid()))', t);
    execute format(
      'create policy "Add own rows" on public.%I for insert to authenticated
         with check (user_id = (select auth.uid()))', t);
    if t = 'ledger_events' then
      execute format('grant select, insert on table public.%I to authenticated', t);
    else
      execute format(
        'create policy "Change own rows" on public.%I for update to authenticated
           using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
      execute format('grant select, insert, update on table public.%I to authenticated', t);
    end if;
    -- No delete policy: clients soft-delete with deleted_at and never hard-delete.
  end loop;
end
$$;

-- Natural keys: a reward is paid once per user (replays and two offline devices cannot
-- double-pay); an achievement is unlocked once per user.
create unique index ledger_events_user_dedupe_key on public.ledger_events (user_id, dedupe_key);
create unique index achievements_user_achievement on public.achievements (user_id, achievement_id)
  where deleted_at is null;

-- Weekly XP (recap now; friends-only leaderboards later) and streak days.
create index ledger_events_user_day on public.ledger_events (user_id, day);

-- Reminders: quests with a due date.
create index quests_user_due on public.quests (user_id, due_date)
  where due_date is not null and deleted_at is null;

-- Later social features: a friend code is unique across all players.
create unique index profile_friend_code on public.profile (friend_code) where friend_code is not null;

-- Realtime: changes reach the player's other devices in near real time (RLS applies).
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array public.sync_tables() loop
      execute format('alter publication supabase_realtime add table public.%I', t);
    end loop;
  end if;
end
$$;
