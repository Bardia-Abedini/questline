-- Server-only tables for the edge functions: AI limits, Google Calendar tokens, OAuth state,
-- web push subscriptions and the reminder log. Clients can never read tokens or secrets: RLS
-- is on and there is no policy (or only a read policy for harmless rows); the functions use
-- the service role.

------------------------------------------------------------------------------- AI limits

-- Requests per user per (UTC) day. The `ai` function is the only writer.
create table public.ai_quota (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  used integer not null default 0,
  primary key (user_id, day)
);
alter table public.ai_quota enable row level security;
revoke all on table public.ai_quota from anon, authenticated;
grant select on table public.ai_quota to authenticated;
grant all on table public.ai_quota to service_role;
create policy "Read own AI usage" on public.ai_quota for select to authenticated
  using (user_id = (select auth.uid()));

-- Takes one request from the user's daily allowance, atomically. Returns
-- {"allowed": bool, "used": n, "limit": n}.
create or replace function public.ai_consume(p_user uuid, p_day date, p_limit integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_used integer;
begin
  insert into public.ai_quota as q (user_id, day, used) values (p_user, p_day, 1)
    on conflict (user_id, day) do update set used = q.used + 1 where q.used < p_limit
    returning q.used into v_used;
  if v_used is null then
    select q.used into v_used from public.ai_quota q where q.user_id = p_user and q.day = p_day;
    return jsonb_build_object('allowed', false, 'used', coalesce(v_used, 0), 'limit', p_limit);
  end if;
  return jsonb_build_object('allowed', true, 'used', v_used, 'limit', p_limit);
end
$$;

-- Gives a request back when the AI provider failed (not the player's fault).
create or replace function public.ai_refund(p_user uuid, p_day date)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.ai_quota set used = greatest(used - 1, 0) where user_id = p_user and day = p_day
$$;

revoke execute on function public.ai_consume(uuid, date, integer) from public, anon, authenticated;
revoke execute on function public.ai_refund(uuid, date) from public, anon, authenticated;
grant execute on function public.ai_consume(uuid, date, integer) to service_role;
grant execute on function public.ai_refund(uuid, date) to service_role;

----------------------------------------------------------------------- Google Calendar

-- OAuth tokens. Never readable by any client (no policy, no grant).
create table public.google_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  google_email text,
  refresh_token text not null,
  access_token text,
  access_token_expires_at timestamptz,
  scope text,
  -- The dedicated "Questline" calendar.
  calendar_id text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.google_tokens enable row level security;
revoke all on table public.google_tokens from anon, authenticated;
grant all on table public.google_tokens to service_role;

-- One-time OAuth `state` values (CSRF protection), valid for 10 minutes.
create table public.oauth_states (
  state text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  code_verifier text not null,
  return_to text not null,
  created_at timestamptz not null default now()
);
alter table public.oauth_states enable row level security;
revoke all on table public.oauth_states from anon, authenticated;
grant all on table public.oauth_states to service_role;

----------------------------------------------------------------------------- Web push

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_success_at timestamptz,
  failure_count integer not null default 0
);
create index push_subscriptions_user on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
revoke all on table public.push_subscriptions from anon, authenticated;
grant select on table public.push_subscriptions to authenticated;
grant all on table public.push_subscriptions to service_role;
create policy "Read own push subscriptions" on public.push_subscriptions for select
  to authenticated using (user_id = (select auth.uid()));

-- Reminders already sent: one row per (user, fire key), so a reminder is sent once even if
-- the scheduler runs twice or overlaps.
create table public.reminder_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  fire_key text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, fire_key)
);
create index reminder_log_sent_at on public.reminder_log (sent_at);
alter table public.reminder_log enable row level security;
revoke all on table public.reminder_log from anon, authenticated;
grant all on table public.reminder_log to service_role;
