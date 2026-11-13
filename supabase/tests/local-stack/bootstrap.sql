-- Minimal stand-in for what the Supabase Postgres image sets up before migrations run:
-- API roles, the auth schema, Supabase's default grants and the realtime publication.
-- Only used by the Docker-free local stack (start.mjs); `supabase start` does not need it.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login noinherit password 'local-authenticator';
  end if;
end
$$;

grant anon, authenticated, service_role to authenticator;
create schema if not exists auth;

grant usage on schema public to anon, authenticated, service_role;
-- Supabase grants everything in public to the API roles by default; the migrations revoke
-- what they must, so keep the same default here to test that they do.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end
$$;
