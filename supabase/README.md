# Questline backend (Supabase)

Everything here is optional: with no `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` the app is
a complete guest app that never loads Supabase code. This file is for developers; the
owner-facing setup guide (`docs/SETUP.md`) is written from it.

## What is here

| Path                                 | What                                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `migrations/…100_sync_tables.sql`    | One table per syncable Dexie table, same names and columns (+ `server_updated_at`)                                 |
| `migrations/…200_sync_rules.sql`     | Last-write-wins trigger, pull indexes, RLS on every table, append-only ledger, realtime                            |
| `migrations/…300_sync_functions.sql` | RPC: `sync_state`, `sync_push`, `sync_pull`, `account_has_data`, `reset_my_data`, `delete_my_account`, `weekly_xp` |
| `migrations/…400_services.sql`       | Server-only tables: `ai_quota`, `google_tokens`, `oauth_states`, `push_subscriptions`, `reminder_log`              |
| `functions/ai`                       | Claude Messages API for every method of the app's `useAi()` client                                                 |
| `functions/calendar`                 | Google OAuth (offline, PKCE) and the "Questline" calendar                                                          |
| `functions/push`                     | Web push subscriptions and the reminder scheduler (`tick`)                                                         |
| `functions/_shared`                  | Pure modules shared with the app's unit tests (AI prompts and validation, reminders, Web Push crypto, CORS)        |
| `tests/database/sync_rls.test.sql`   | RLS and sync rules, two users (46 checks)                                                                          |
| `tests/local-stack`                  | A Docker-free stand-in for `supabase start` (see below)                                                            |
| `scripts/generate-vapid-keys.mjs`    | Makes the web push key pair                                                                                        |

## How sync works (short)

- Every local write goes to the Dexie outbox (`recordChange`). `src/data/sync/engine.ts` pushes
  it in order through `sync_push`, pulls each table through `sync_pull` by the server cursor
  `(server_updated_at, id)`, and listens to Realtime (`postgres_changes`, filtered by
  `user_id`) to pull a table as soon as it changes. Without Realtime it polls every 30 s.
- Last write wins per row by `updated_at`. The server moves edit times onto its own clock when
  a device's clock is off by more than 2 s, clamps future times, skips older and unchanged
  writes, and never lets `id`, `user_id` or `created_at` change.
- `ledger_events` is insert-only (a trigger blocks updates and deletes, also for the service
  role). `(user_id, dedupe_key)` is unique, so a reward replayed or granted on two offline
  devices is paid once; every device converges on the first row. Achievements likewise.
- Soft deletes only (`deleted_at`); clients have no delete grant.
- "Keep this device's data" calls `reset_my_data()`, which removes the account's rows and bumps
  `account_state.data_epoch`; other devices notice the new epoch and reload.

## Run it locally

### With the Supabase CLI (preferred, needs Docker)

```bash
npx supabase start                 # Postgres, Auth, REST, Realtime, Studio, Inbucket, functions
npx supabase db reset              # applies migrations/ to a fresh database
psql postgres://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -o /dev/null \
  -f supabase/tests/database/sync_rls.test.sql
npx supabase functions serve --env-file supabase/.env.functions.local   # see "Secrets"
```

Put the printed `API URL` and `anon key` in `.env.local` as `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY`, then `npm run dev`. Emails (confirmation, reset) appear in Inbucket at
http://localhost:54324.

### Without Docker images (what this repo's tests used)

`tests/local-stack/start.mjs` runs the real pieces from local binaries: Postgres 15+, Supabase
Auth (`gotrue`), PostgREST and Deno, behind a small gateway with Supabase's URL layout on port 54321. Realtime, Storage, Studio and email are not included (new accounts are auto-confirmed).

```bash
GOTRUE_BIN=/path/to/gotrue POSTGREST_BIN=/path/to/postgrest DENO_BIN=/path/to/deno \
SITE_URL=http://localhost:4185 node supabase/tests/local-stack/start.mjs --reset
# writes supabase/tests/local-stack/.env.local (URL, anon key, service key, DATABASE_URL)
psql postgres://postgres@localhost:54322/postgres -v ON_ERROR_STOP=1 -o /dev/null \
  -f supabase/tests/database/sync_rls.test.sql
# Browser tests against it (sign-up, two-device sync, sign-out):
VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=<anon key from .env.local> \
E2E_SUPABASE=1 E2E_PORT=4185 npx playwright test e2e/cloud.spec.ts
```

Binaries: `gotrue` from https://github.com/supabase/auth/releases (`auth-v*-x86.tar.gz`),
PostgREST from https://github.com/PostgREST/postgrest/releases, Deno via `npm i deno`.

## Deploy

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push                               # all migrations
npx supabase functions deploy ai
npx supabase functions deploy calendar --no-verify-jwt
npx supabase functions deploy push --no-verify-jwt
npx supabase secrets set --env-file supabase/.env.functions   # see below
```

`calendar` and `push` must be deployed with `--no-verify-jwt` (also set in `config.toml`):
Google's OAuth redirect and the scheduler call them without a user JWT. Both verify the JWT
themselves for every player request.

Then in the dashboard:

- **Auth → URL configuration**: Site URL = the app's URL; add `https://<app>/account` to the
  redirect URLs (email confirmation, password reset and Google sign-in return there).
- **Auth → Providers → Google** (for "Continue with Google"): the Google OAuth client ID and
  secret; in Google Cloud add `https://<project-ref>.supabase.co/auth/v1/callback` as an
  authorized redirect URI.
- **Database → Replication**: the migration adds every sync table to the `supabase_realtime`
  publication; nothing to do unless that publication was removed.
- **Reminder scheduler** (needs the `pg_cron` and `pg_net` extensions, Database → Extensions):

```sql
select cron.schedule('questline-reminders', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/push',
    headers := jsonb_build_object('content-type', 'application/json',
                                  'x-cron-secret', '<CRON_SECRET>'),
    body := '{"action":"tick"}'::jsonb)
$$);
```

## Secrets (function environment)

Set with `supabase secrets set NAME=value` (or an env file). `SUPABASE_URL`,
`SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided by Supabase automatically.
Nothing here is ever sent to the browser.

| Function   | Secret                 | Required     | Notes                                                                                                                                                       |
| ---------- | ---------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| all        | `ALLOWED_ORIGINS`      | yes          | Comma list of app origins for CORS, e.g. `https://questline.app,http://localhost:5173`; `http://localhost:*` allows any port. Default `http://localhost:*`. |
| `ai`       | `ANTHROPIC_API_KEY`    | for AI       | Without it the app shows "AI is not set up yet".                                                                                                            |
| `ai`       | `ANTHROPIC_MODEL`      | no           | Default `claude-haiku-5-5` (small, fast, cheapest per request; the tasks are short structured outputs). Any current model id works.                         |
| `ai`       | `ANTHROPIC_EFFORT`     | no           | `low` (default), `medium` or `high`.                                                                                                                        |
| `ai`       | `ANTHROPIC_FALLBACKS`  | no           | `on` (default): server-side refusal fallback, sent only for models that support it (Opus 5.x, Fable 5.x, Sonnet 5.5; not Haiku); `off` to disable.          |
| `ai`       | `AI_DAILY_LIMIT`       | no           | Requests per player per UTC day. Default 50.                                                                                                                |
| `calendar` | `GOOGLE_CLIENT_ID`     | for calendar | Google OAuth client (type "Web application").                                                                                                               |
| `calendar` | `GOOGLE_CLIENT_SECRET` | for calendar |                                                                                                                                                             |
| `calendar` | `GOOGLE_REDIRECT_URI`  | no           | Default `<SUPABASE_URL>/functions/v1/calendar/callback`. Add this exact URL to the Google client's authorized redirect URIs.                                |
| `push`     | `VAPID_PUBLIC_KEY`     | for push     | From `node supabase/scripts/generate-vapid-keys.mjs`.                                                                                                       |
| `push`     | `VAPID_PRIVATE_KEY`    | for push     |                                                                                                                                                             |
| `push`     | `VAPID_SUBJECT`        | for push     | `mailto:` address push services can contact.                                                                                                                |
| `push`     | `CRON_SECRET`          | for push     | Any long random string; the scheduler sends it as `x-cron-secret`.                                                                                          |

Google Cloud console for the calendar client: enable the **Google Calendar API**; OAuth
consent screen scopes `openid`, `email`, `.../auth/calendar.readonly` (read events for the
day view) and `.../auth/calendar.app.created` (manage only the "Questline" calendar it
creates). Until the app is verified by Google, add testers on the consent screen.

## Function API

All are `POST` with JSON and `Authorization: Bearer <user JWT>` unless noted. Errors are
`{ "error": code }` with `not_signed_in` (401), `bad_input` (400), `not_configured` (503),
`limit_reached` (429), `not_connected` / `reconnect` (409), `bad_output` / `failed` (502).

- `ai`: `status` → `{configured, used, limit}`; `breakdown {title, notes?}`,
  `split {questTitle, stepTitle, guessMinutes?}`, `suggest_meta {title, notes?}`,
  `classify {steps}`, `brain_dump {text}`, `explain {questTitle, reasons}` → `{result, used,
limit}`; each takes `lang` (`en`/`fa`). Input limits in `_shared/ai.ts` (`LIMITS`). Output is
  requested as structured JSON and validated (3 to 7 steps, first under 5 minutes, enums,
  ranges); an invalid reply is retried once, then `bad_output` and the request is refunded.
  Logs carry the action, outcome and timing only, never task text.
- `calendar`: `status`, `connect {returnTo}` → `{url}` (returnTo must be on an allowed origin),
  `GET /calendar/callback` (Google), `disconnect` (revokes and deletes tokens), `day {timeMin,
timeMax}` → `{events}`, `upsert {event}`, `delete {type, entityId}`. Event ids are derived from
  the quest / focus block id, so every device updates the same event.
- `push`: `config` → `{configured, publicKey}`, `subscribe {subscription}`, `unsubscribe
{endpoint}`, `unsubscribe_all`, `test`; `tick` with `x-cron-secret` (scheduler).

## Account deletion and sign-out

- `delete_my_account()` deletes the auth user; every table references `auth.users` with
  `on delete cascade`, so synced data, Google tokens, push subscriptions, AI counters and the
  reminder log go with it. The app first revokes Google access and push subscriptions.
- Sign-out removes the account's data from the device and starts a fresh guest database
  (language and appearance are kept). Unsynced changes are pushed first; if that fails the
  player is asked before anything is lost.
