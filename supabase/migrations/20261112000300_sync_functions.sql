-- Sync API used by the client (src/data/sync/supabaseRemote.ts) through PostgREST RPC.
-- Every function runs as the caller (security invoker) unless it says otherwise, so
-- row-level security applies to everything it reads and writes.

-- One row per account. `data_epoch` changes when the account's data is replaced from one
-- device ("Keep this device's data"); other devices then reload everything.
create table public.account_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data_epoch integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.account_state enable row level security;
revoke all on table public.account_state from anon, authenticated;
grant select on table public.account_state to authenticated;
grant all on table public.account_state to service_role;
create policy "Read own state" on public.account_state for select to authenticated
  using (user_id = (select auth.uid()));

-- The account's data epoch and the server clock.
create or replace function public.sync_state()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  epoch integer;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  insert into public.account_state (user_id) values (uid) on conflict (user_id) do nothing;
  select s.data_epoch into epoch from public.account_state s where s.user_id = uid;
  return jsonb_build_object('epoch', epoch, 'server_now', now());
end
$$;

-- Push local changes for one table. Rows are taken as the caller's (user_id is overwritten),
-- edit times are moved from the device clock onto the server clock when the device clock is
-- off by more than 2 seconds, and last-write-wins is enforced by the table trigger.
-- Natural-key tables keep the first row per key; ledger rows are insert-only.
-- Returns the stored version of every pushed row (and of the rows that own a pushed natural
-- key), so the device converges on what the server kept.
create or replace function public.sync_push(
  p_table text,
  p_rows jsonb,
  p_client_now timestamptz default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  server_now timestamptz := now();
  skew interval := interval '0';
  natural_key text;
  rows jsonb;
  ids uuid[];
  keys text[];
  update_cols text;
  result jsonb;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if p_table is null or not (p_table = any (public.sync_tables())) then
    raise exception 'Unknown table: %', p_table using errcode = '22023';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows must be a JSON array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) > 500 then
    raise exception 'At most 500 rows per push' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_rows) r where jsonb_typeof(r) <> 'object') then
    raise exception 'Every row must be a JSON object' using errcode = '22023';
  end if;

  if p_client_now is not null and abs(extract(epoch from server_now - p_client_now)) > 2 then
    skew := server_now - p_client_now;
  end if;

  select coalesce(jsonb_agg(
           r || jsonb_build_object(
             'user_id', uid,
             'updated_at', ((r ->> 'updated_at')::timestamptz + skew)
           )
         ), '[]'::jsonb)
    into rows
    from jsonb_array_elements(p_rows) r;

  ids := array(select (r ->> 'id')::uuid from jsonb_array_elements(rows) r);
  natural_key := case p_table
    when 'ledger_events' then 'dedupe_key'
    when 'achievements' then 'achievement_id'
  end;

  if natural_key is not null then
    keys := array(select r ->> natural_key from jsonb_array_elements(rows) r);
    -- Skip rows whose natural key the account already has under another id.
    execute format(
      $q$select coalesce(jsonb_agg(r), '[]'::jsonb) from jsonb_array_elements($1) r
         where not exists (
           select 1 from public.%1$I t
            where t.user_id = $2 and t.%2$I = r ->> %3$L and t.id <> (r ->> 'id')::uuid %4$s)$q$,
      p_table, natural_key, natural_key,
      case when p_table = 'achievements' then 'and t.deleted_at is null' else '' end)
      into rows using rows, uid;
  end if;

  if p_table = 'ledger_events' then
    insert into public.ledger_events
      select * from jsonb_populate_recordset(null::public.ledger_events, rows)
      on conflict do nothing;
  else
    select string_agg(format('%1$I = excluded.%1$I', a.attname), ', ' order by a.attnum)
      into update_cols
      from pg_catalog.pg_attribute a
     where a.attrelid = format('public.%I', p_table)::regclass
       and a.attnum > 0
       and not a.attisdropped
       and a.attname not in ('id', 'user_id', 'created_at', 'server_updated_at');
    execute format(
      'insert into public.%1$I as t select * from jsonb_populate_recordset(null::public.%1$I, $1)
         on conflict (id) do update set %2$s',
      p_table, update_cols)
      using rows;
  end if;

  execute format(
    'select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from public.%1$I t
      where t.user_id = $2 and (t.id = any ($1) %2$s)',
    p_table,
    case when natural_key is null then '' else format('or t.%I = any ($3)', natural_key) end)
    into result using ids, uid, keys;

  return jsonb_build_object('rows', result, 'server_now', now());
end
$$;

-- Pull one page of a table's rows changed after a cursor (server_updated_at, id), oldest first.
create or replace function public.sync_pull(
  p_table text,
  p_after_ts timestamptz default null,
  p_after_id uuid default null,
  p_limit integer default 500
)
returns jsonb
language plpgsql
security invoker
stable
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  result jsonb;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if p_table is null or not (p_table = any (public.sync_tables())) then
    raise exception 'Unknown table: %', p_table using errcode = '22023';
  end if;
  execute format(
    $q$select coalesce(jsonb_agg(to_jsonb(x) order by x.server_updated_at, x.id), '[]'::jsonb)
       from (select * from public.%I t
              where t.user_id = $1 and (t.server_updated_at, t.id) > ($2, $3)
              order by t.server_updated_at, t.id
              limit $4) x$q$,
    p_table)
    into result
    using uid,
          coalesce(p_after_ts, '-infinity'::timestamptz),
          coalesce(p_after_id, '00000000-0000-0000-0000-000000000000'::uuid),
          least(greatest(coalesce(p_limit, 500), 1), 1000);
  return jsonb_build_object('rows', result, 'server_now', now());
end
$$;

-- Whether the account has any real data (anything beyond the per-device defaults: the one-row
-- tables and untouched default categories). Decides whether signing in on a device with guest
-- data needs the Merge / Keep account / Keep device choice.
create or replace function public.account_has_data()
returns boolean
language plpgsql
security invoker
stable
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  t text;
  found_row boolean;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  foreach t in array public.sync_tables() loop
    continue when t in ('profile', 'settings', 'streak_state', 'notification_prefs', 'categories');
    execute format(
      'select exists (select 1 from public.%I where user_id = $1 and deleted_at is null)', t)
      into found_row using uid;
    if found_row then
      return true;
    end if;
  end loop;
  return exists (
    select 1 from public.categories c
     where c.user_id = uid and c.deleted_at is null
       and (c.name_key is null or coalesce(c.name, '') <> '')
  );
end
$$;

-- "Keep this device's data": removes every synced row of the account (the ledger included)
-- and starts a new data epoch, so the account's other devices reload. The device then uploads
-- its own data. AI usage counters are kept.
create or replace function public.reset_my_data()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  t text;
  epoch integer;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  perform set_config('questline.allow_ledger_delete', 'on', true);
  foreach t in array public.sync_tables() loop
    execute format('delete from public.%I where user_id = $1', t) using uid;
  end loop;
  delete from public.reminder_log where user_id = uid;
  insert into public.account_state (user_id, data_epoch) values (uid, 1)
    on conflict (user_id) do update
      set data_epoch = public.account_state.data_epoch + 1, updated_at = now()
    returning data_epoch into epoch;
  perform set_config('questline.allow_ledger_delete', 'off', true);
  return epoch;
end
$$;

-- Deletes the caller's account and, through foreign keys, every row they own on the server
-- (synced data, Google tokens, push subscriptions, AI counters, reminder log).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  perform set_config('questline.allow_ledger_delete', 'on', true);
  delete from auth.users where id = uid;
end
$$;

-- XP earned in the 7 days starting on p_week_start (weekly recap; later, leaderboards).
create or replace function public.weekly_xp(p_week_start date)
returns integer
language sql
security invoker
stable
set search_path = ''
as $$
  select coalesce(sum(greatest(e.xp, 0)), 0)::integer
    from public.ledger_events e
   where e.user_id = (select auth.uid())
     and e.deleted_at is null
     and e.day >= p_week_start
     and e.day < p_week_start + 7
$$;

revoke execute on function public.sync_state() from public, anon;
revoke execute on function public.sync_push(text, jsonb, timestamptz) from public, anon;
revoke execute on function public.sync_pull(text, timestamptz, uuid, integer) from public, anon;
revoke execute on function public.account_has_data() from public, anon;
revoke execute on function public.reset_my_data() from public, anon;
revoke execute on function public.delete_my_account() from public, anon;
revoke execute on function public.weekly_xp(date) from public, anon;
grant execute on function public.sync_state() to authenticated;
grant execute on function public.sync_push(text, jsonb, timestamptz) to authenticated;
grant execute on function public.sync_pull(text, timestamptz, uuid, integer) to authenticated;
grant execute on function public.account_has_data() to authenticated;
grant execute on function public.reset_my_data() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.weekly_xp(date) to authenticated;
