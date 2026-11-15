-- After the auth server created its schema: let the API roles call auth.uid() / auth.jwt()
-- inside row-level security policies, as on Supabase.
grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;

create table if not exists public.local_stack_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);
revoke all on table public.local_stack_migrations from anon, authenticated;
