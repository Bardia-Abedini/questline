-- Row-level security and sync function tests. Plain SQL (no pgTAP needed): every check raises
-- on failure, and everything runs in one transaction that is rolled back.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/database/sync_rls.test.sql
--
-- Works against `supabase start` (postgres://postgres:postgres@127.0.0.1:54322/postgres) and
-- the Docker-free local stack (supabase/tests/local-stack).
\set QUIET on
begin;

create function pg_temp.ok(cond boolean, what text) returns void language plpgsql as $$
begin
  if cond is distinct from true then
    raise exception 'FAILED: %', what;
  end if;
  raise notice 'ok - %', what;
end $$;

-- Runs a statement and returns the SQLSTATE it failed with (null if it succeeded).
create function pg_temp.fails(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlstate;
end $$;

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  set local role authenticated;
end $$;

grant execute on all functions in schema pg_temp to authenticated, anon;

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'a@test.local', now(), now()),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'b@test.local', now(), now());

-------------------------------------------------------------------------- user A writes
select pg_temp.act_as('aaaaaaaa-0000-4000-8000-000000000001');

select pg_temp.ok(
  (public.account_has_data()) = false,
  'a new account has no data');

select pg_temp.ok(
  jsonb_array_length(public.sync_push('quests', jsonb_build_array(jsonb_build_object(
    'id', 'a0000000-0000-4000-8000-0000000000a1', 'user_id', null,
    'created_at', '2026-03-10T09:00:00.000Z', 'updated_at', '2026-03-10T09:00:00.000Z',
    'deleted_at', null, 'title', 'A secret quest', 'status', 'active', 'tag_ids', '[]'::jsonb,
    'position', 1.5, 'due_date', '2026-03-12', 'is_boss', false)),
    now()) -> 'rows') = 1,
  'sync_push stores a guest row (user_id null) for the caller');

select pg_temp.ok(
  (select user_id from public.quests where id = 'a0000000-0000-4000-8000-0000000000a1')
    = 'aaaaaaaa-0000-4000-8000-000000000001',
  'the server stamps the owner');

select pg_temp.ok(public.account_has_data(), 'the account now has data');

select pg_temp.ok(
  (public.sync_pull('quests') -> 'rows' -> 0 ->> 'title') = 'A secret quest'
  and (public.sync_pull('quests') -> 'rows' -> 0 ->> 'due_date') = '2026-03-12'
  and (public.sync_pull('quests') -> 'rows' -> 0 -> 'position')::text = '1.5',
  'sync_pull returns the row with its types intact');

-- Last write wins.
select public.sync_push('quests', jsonb_build_array(jsonb_build_object(
  'id', 'a0000000-0000-4000-8000-0000000000a1', 'created_at', '2026-03-10T09:00:00.000Z',
  'updated_at', '2026-03-10T08:00:00.000Z', 'title', 'Older edit')), now());
select pg_temp.ok(
  (select title from public.quests where id = 'a0000000-0000-4000-8000-0000000000a1') = 'A secret quest',
  'an older edit does not overwrite a newer one');

select public.sync_push('quests', jsonb_build_array(jsonb_build_object(
  'id', 'a0000000-0000-4000-8000-0000000000a1', 'created_at', '2026-01-01T00:00:00.000Z',
  'updated_at', '2026-03-10T10:00:00.000Z', 'title', 'Newer edit', 'status', 'active')), now());
select pg_temp.ok(
  (select title from public.quests where id = 'a0000000-0000-4000-8000-0000000000a1') = 'Newer edit',
  'a newer edit wins');
select pg_temp.ok(
  (select created_at from public.quests where id = 'a0000000-0000-4000-8000-0000000000a1')
    = '2026-03-10T09:00:00.000Z'::timestamptz,
  'created_at never changes');

-- Clock skew: a device clock one hour slow; its edit time is moved onto the server clock.
select public.sync_push('tags', jsonb_build_array(jsonb_build_object(
  'id', 'a0000000-0000-4000-8000-0000000000b1', 'created_at', now() - interval '1 hour',
  'updated_at', now() - interval '1 hour', 'name', 'slow clock')), now() - interval '1 hour');
select pg_temp.ok(
  abs(extract(epoch from (select updated_at from public.tags
                          where id = 'a0000000-0000-4000-8000-0000000000b1') - now())) < 1,
  'a slow device clock is corrected by the measured skew');

-- A device clock in the future is clamped to the server clock.
select public.sync_push('tags', jsonb_build_array(jsonb_build_object(
  'id', 'a0000000-0000-4000-8000-0000000000b2', 'created_at', now(),
  'updated_at', now() + interval '3 days', 'name', 'fast clock')), null);
select pg_temp.ok(
  (select updated_at from public.tags where id = 'a0000000-0000-4000-8000-0000000000b2') <= now(),
  'a future edit time is clamped to the server clock');

-- Ledger: append-only, idempotent per dedupe key.
select public.sync_push('ledger_events', jsonb_build_array(jsonb_build_object(
  'id', 'a0000000-0000-4000-8000-0000000000c1', 'created_at', now(), 'updated_at', now(),
  'kind', 'step_reward', 'xp', 20, 'gold', 10, 'source_type', 'step', 'dedupe_key', 'step:1',
  'occurred_at', now(), 'day', '2026-03-10')), now());
select pg_temp.ok(
  (public.sync_push('ledger_events', jsonb_build_array(jsonb_build_object(
    'id', 'a0000000-0000-4000-8000-0000000000c2', 'created_at', now(), 'updated_at', now(),
    'kind', 'step_reward', 'xp', 999, 'gold', 999, 'source_type', 'step', 'dedupe_key', 'step:1',
    'occurred_at', now(), 'day', '2026-03-10')), now()) -> 'rows' -> 0 ->> 'id')
    = 'a0000000-0000-4000-8000-0000000000c1',
  'a second reward with the same dedupe key is not paid; the first one is returned');
select pg_temp.ok(
  (select sum(xp) from public.ledger_events) = 20,
  'replays cannot double-pay');
select public.sync_push('ledger_events', jsonb_build_array(jsonb_build_object(
  'id', 'a0000000-0000-4000-8000-0000000000c1', 'created_at', now(), 'updated_at', now(),
  'kind', 'step_reward', 'xp', 5000, 'gold', 5000, 'source_type', 'step', 'dedupe_key', 'step:1',
  'occurred_at', now(), 'day', '2026-03-10')), now());
select pg_temp.ok(
  (select xp from public.ledger_events where id = 'a0000000-0000-4000-8000-0000000000c1') = 20,
  'a pushed ledger row never changes an existing one');
select pg_temp.ok(
  pg_temp.fails($$update public.ledger_events set xp = 1000$$) = '42501',
  'the owner cannot update ledger rows');
select pg_temp.ok(
  pg_temp.fails($$delete from public.ledger_events$$) = '42501',
  'the owner cannot delete ledger rows');
select pg_temp.ok(public.weekly_xp('2026-03-09') = 20, 'weekly XP is derivable');

-- Achievements: one per catalog id.
select public.sync_push('achievements', jsonb_build_array(jsonb_build_object(
  'id', 'a0000000-0000-4000-8000-0000000000d1', 'created_at', now(), 'updated_at', now(),
  'achievement_id', 'first_quest', 'unlocked_at', now())), now());
select public.sync_push('achievements', jsonb_build_array(jsonb_build_object(
  'id', 'a0000000-0000-4000-8000-0000000000d2', 'created_at', now(), 'updated_at', now(),
  'achievement_id', 'first_quest', 'unlocked_at', now())), now());
select pg_temp.ok(
  (select count(*) from public.achievements) = 1,
  'an achievement unlocked on two devices is stored once');

select pg_temp.ok(
  pg_temp.fails($$delete from public.quests$$) = '42501',
  'clients cannot hard-delete synced rows');

select pg_temp.ok(
  pg_temp.fails($$select public.sync_push('auth.users', '[]'::jsonb, null)$$) = '22023',
  'sync_push only accepts sync tables');

-------------------------------------------------------------------------- user B reads
reset role;
select pg_temp.act_as('bbbbbbbb-0000-4000-8000-000000000002');

select pg_temp.ok((select count(*) from public.quests) = 0, 'B cannot see A''s quests');
select pg_temp.ok((select count(*) from public.ledger_events) = 0, 'B cannot see A''s ledger');
select pg_temp.ok(
  jsonb_array_length(public.sync_pull('quests') -> 'rows') = 0,
  'sync_pull never returns another user''s rows');
select pg_temp.ok(public.account_has_data() = false, 'B''s account is empty');

update public.quests set title = 'hacked';
reset role;
select pg_temp.ok(
  (select title from public.quests where id = 'a0000000-0000-4000-8000-0000000000a1') = 'Newer edit',
  'B cannot update A''s rows');
select pg_temp.act_as('bbbbbbbb-0000-4000-8000-000000000002');

select pg_temp.ok(
  pg_temp.fails($$select public.sync_push('quests', jsonb_build_array(jsonb_build_object(
    'id', 'a0000000-0000-4000-8000-0000000000a1', 'created_at', now(),
    'updated_at', now(), 'title', 'taken over')), now())$$) is not null,
  'B cannot overwrite A''s row by pushing its id');
reset role;
select pg_temp.ok(
  (select user_id from public.quests where id = 'a0000000-0000-4000-8000-0000000000a1')
    = 'aaaaaaaa-0000-4000-8000-000000000001'
  and (select title from public.quests where id = 'a0000000-0000-4000-8000-0000000000a1') = 'Newer edit',
  'A''s row is unchanged after B''s attempt');
select pg_temp.act_as('bbbbbbbb-0000-4000-8000-000000000002');

select pg_temp.ok(
  pg_temp.fails($$insert into public.tags (id, user_id, created_at, updated_at, name)
    values (gen_random_uuid(), 'aaaaaaaa-0000-4000-8000-000000000001', now(), now(), 'x')$$) = '42501',
  'B cannot insert rows owned by A');

select public.sync_push('tags', jsonb_build_array(jsonb_build_object(
  'id', 'b0000000-0000-4000-8000-0000000000b1', 'user_id', 'aaaaaaaa-0000-4000-8000-000000000001',
  'created_at', now(), 'updated_at', now(), 'name', 'mine')), now());
reset role;
select pg_temp.ok(
  (select user_id from public.tags where id = 'b0000000-0000-4000-8000-0000000000b1')
    = 'bbbbbbbb-0000-4000-8000-000000000002',
  'sync_push ignores a user_id in the payload');
select pg_temp.act_as('bbbbbbbb-0000-4000-8000-000000000002');

-- Secrets are never readable by clients.
select pg_temp.ok(pg_temp.fails($$select * from public.google_tokens$$) = '42501', 'no client access to Google tokens');
select pg_temp.ok(pg_temp.fails($$select * from public.oauth_states$$) = '42501', 'no client access to OAuth state');
select pg_temp.ok(pg_temp.fails($$select * from public.reminder_log$$) = '42501', 'no client access to the reminder log');
select pg_temp.ok(
  pg_temp.fails($$select public.ai_consume('bbbbbbbb-0000-4000-8000-000000000002', current_date, 1000)$$) = '42501',
  'clients cannot spend or reset AI allowance');
select pg_temp.ok(
  pg_temp.fails($$insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
    values ('bbbbbbbb-0000-4000-8000-000000000002', 'https://push.example/x', 'k', 'a')$$) = '42501',
  'push subscriptions are managed by the push function');

-------------------------------------------------------------------------- anonymous
reset role;
set local role anon;
select pg_temp.ok(pg_temp.fails($$select * from public.quests$$) = '42501', 'anon cannot read synced tables');
select pg_temp.ok(pg_temp.fails($$select public.sync_state()$$) = '42501', 'anon cannot call sync functions');

-------------------------------------------------------------------------- service
reset role;
select pg_temp.ok(
  (public.ai_consume('bbbbbbbb-0000-4000-8000-000000000002', '2026-03-10', 2) ->> 'allowed')::boolean
  and (public.ai_consume('bbbbbbbb-0000-4000-8000-000000000002', '2026-03-10', 2) ->> 'used')::int = 2
  and not (public.ai_consume('bbbbbbbb-0000-4000-8000-000000000002', '2026-03-10', 2) ->> 'allowed')::boolean,
  'the daily AI limit is enforced atomically');
select pg_temp.ok(
  pg_temp.fails($$update public.ledger_events set xp = 1$$) = '42501',
  'the ledger is append-only even for the service role');

-------------------------------------------------------------------------- reset and delete
select pg_temp.act_as('aaaaaaaa-0000-4000-8000-000000000001');
select pg_temp.ok(public.reset_my_data() = 1, 'replacing account data starts a new epoch');
select pg_temp.ok((public.sync_state() ->> 'epoch')::int = 1, 'sync_state reports the epoch');
select pg_temp.ok(
  (select count(*) from public.quests) = 0 and (select count(*) from public.ledger_events) = 0,
  'reset removes the account''s rows, the ledger included');

select public.sync_push('ledger_events', jsonb_build_array(jsonb_build_object(
  'id', 'a0000000-0000-4000-8000-0000000000c9', 'created_at', now(), 'updated_at', now(),
  'kind', 'achievement', 'xp', 5, 'gold', 5, 'source_type', 'achievement', 'dedupe_key', 'achievement:x',
  'occurred_at', now(), 'day', '2026-03-10')), now());
select public.delete_my_account();
reset role;
select pg_temp.ok(
  not exists (select 1 from auth.users where id = 'aaaaaaaa-0000-4000-8000-000000000001')
  and not exists (select 1 from public.ledger_events where user_id = 'aaaaaaaa-0000-4000-8000-000000000001')
  and not exists (select 1 from public.account_state where user_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'deleting the account removes all of its data');
select pg_temp.ok(
  exists (select 1 from public.tags where user_id = 'bbbbbbbb-0000-4000-8000-000000000002')
  and exists (select 1 from public.ai_quota where user_id = 'bbbbbbbb-0000-4000-8000-000000000002'),
  'other accounts are untouched');

-- An operator deleting a user from the dashboard also works (ledger cascades).
insert into public.ledger_events (id, user_id, created_at, updated_at, kind, xp, gold, source_type, dedupe_key, occurred_at, day)
values (gen_random_uuid(), 'bbbbbbbb-0000-4000-8000-000000000002', now(), now(), 'adjustment', 1, 1, 'system', 'k', now(), '2026-03-10');
delete from auth.users where id = 'bbbbbbbb-0000-4000-8000-000000000002';
select pg_temp.ok(
  not exists (select 1 from public.ledger_events where user_id = 'bbbbbbbb-0000-4000-8000-000000000002'),
  'deleting a user directly cascades through the append-only ledger');

-- Every syncable table has RLS on and no delete policy.
select pg_temp.ok(
  (select bool_and(c.relrowsecurity) from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relname = any (public.sync_tables())),
  'RLS is enabled on every synced table');
select pg_temp.ok(
  (select bool_and(c.relrowsecurity) from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
      and c.relname <> 'local_stack_migrations'),
  'RLS is enabled on every public table');
select pg_temp.ok(
  not exists (select 1 from pg_policies where schemaname = 'public' and cmd in ('DELETE', 'ALL')),
  'no table has a delete policy');

rollback;
\echo 'sync_rls.test.sql: all checks passed'
