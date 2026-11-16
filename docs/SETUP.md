# Setting up Questline

This guide is for the owner of the app. It goes step by step, in order. You do not need to
be an expert: every step says where to click and what to copy where.

Questline works in two layers:

1. **The app on its own** (parts 1 and 2). It runs fully in the browser with no accounts
   and no keys. Everything is saved on the device. This is enough to use Questline.
2. **The online services** (parts 3 to 8), all optional: accounts and sync between devices
   (Supabase), the AI helpers (an Anthropic API key), Google Calendar and Google sign-in
   (a Google OAuth client), and reminders that arrive when the app is closed (web push).

Each online service can be added later, one at a time. Until it is set up, the app simply
says so in a friendly way and everything else keeps working.

> **What has and has not been tested.** The app, sync and the server functions were tested
> against a local stand-in for Supabase, a pretend AI and a pretend Google. They have **not**
> yet been tried with real keys. Part 9 is a checklist to confirm each one works for real.
> Places where this guide could not be checked against the real websites are marked
> **(not confirmed)**: the buttons may be named a little differently there.

Keep a private note (for example in a password manager) while you work. You will collect a
few values along the way:

| Value                                             | Where you get it | Where it goes                               |
| ------------------------------------------------- | ---------------- | ------------------------------------------- |
| App address (e.g. `https://questline.vercel.app`) | Part 2           | Supabase, Google, function secrets          |
| Supabase project ref, URL and anon key            | Part 3           | Vercel environment variables                |
| Anthropic API key                                 | Part 5           | Supabase function secret (never in the app) |
| Google client ID and secret                       | Part 6           | Supabase (sign-in) and function secrets     |
| VAPID public and private keys                     | Part 7           | Supabase function secrets                   |
| Cron secret (a long random string)                | Part 7           | Supabase function secret and the scheduler  |

Only the Supabase URL and the **anon** key ever go into the app. Everything else is a
secret that stays on the server.

---

## 1. Run it on your own computer

You need **Node.js 20.19 or newer** (download the "LTS" version from https://nodejs.org)
and **Git** (https://git-scm.com).

1. Open a terminal (on Windows: "Terminal" or "PowerShell"; on macOS: "Terminal").
2. Download the code and install it:

   ```bash
   git clone https://github.com/<your-account>/questline.git
   cd questline
   npm ci
   ```

3. Start the app:

   ```bash
   npm run dev
   ```

4. Open http://localhost:5173 in your browser. You should see the welcome screens.
5. To stop it, press `Ctrl+C` in the terminal.

To try the real, installable build (with offline support) instead:

```bash
npm run build
npm run preview      # http://localhost:4173
```

To check that everything is healthy: `npm run lint`, `npm run typecheck`, `npm test` and
`npm run e2e` (the last one runs the browser tests and takes a few minutes).

---

## 2. Put it online with Vercel

Vercel builds the app from GitHub and publishes it. Every time you push to the main branch,
it updates by itself.

1. Make sure the code is in a GitHub repository you own.
2. Go to https://vercel.com and choose **Sign Up** (or **Log In**) **with GitHub**.
3. Click **Add New… → Project**.
4. Find the `questline` repository in the list and click **Import**.
5. Vercel reads `vercel.json` from the repository, so the settings are already filled in
   (framework **Vite**, build command `npm run build`, output folder `dist`). Do not
   change them.
6. Leave **Environment Variables** empty for now. The app needs none to build.
7. Click **Deploy** and wait about a minute.
8. When it says it is ready, click the preview to open your app. Copy its address (for
   example `https://questline-yourname.vercel.app`). This is your **app address**.

Optional: to use your own domain, open the project, go to **Settings → Domains**, add the
domain and follow the instructions there. If you do, use that domain as your app address in
every later step.

What `vercel.json` does for you: every page of the app (like `/quests` or `/stats`) is
served by the app itself, the service worker and `index.html` are never cached (so updates
arrive), and the hashed files in `/assets` are cached for a year (they never change).

---

## 3. Create the Supabase project (accounts and sync)

Supabase stores accounts and keeps the player's data in sync between devices.

### 3.1 Create the project

1. Go to https://supabase.com and sign up (GitHub sign-in works).
2. Click **New project**. Pick a name (`questline`), a strong **database password** (save
   it in your private note) and the region closest to your players. Click **Create new
   project** and wait a couple of minutes.
3. Open **Project Settings → General** and copy the **Reference ID** (a short code like
   `abcdxyzabcdxyzabcd`). This is your **project ref**.
4. Open **Project Settings → API** (in newer dashboards: **Project Settings → Data API** and
   **API Keys**) **(not confirmed)** and copy:
   - the **Project URL** (`https://<project-ref>.supabase.co`),
   - the **anon / public** key (a long string). Do **not** copy the `service_role` key
     anywhere; it is never needed in this guide.

### 3.2 Install the Supabase command-line tool and link the project

In the terminal, inside the `questline` folder:

```bash
npx supabase login                               # opens the browser; approve it
npx supabase link --project-ref <project-ref>    # asks for the database password
```

### 3.3 Create the tables (apply the migrations)

```bash
npx supabase db push
```

It lists four migration files and asks to apply them. Answer `Y`. This creates every table,
the security rules (each player can only ever see their own rows) and the sync functions.

### 3.4 Connect the app to Supabase

1. In Vercel, open your project → **Settings → Environment Variables**.
2. Add two variables (for all environments: Production, Preview and Development):
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon key
3. Go to **Deployments**, open the menu (three dots) on the newest one and click
   **Redeploy**. The values are built into the app, so a new build is needed.

For your own computer, copy `.env.example` to `.env.local` and fill in the same two values,
then restart `npm run dev`.

### 3.5 Tell Supabase where the app lives

In Supabase, open **Authentication → URL Configuration**:

1. **Site URL**: your app address, e.g. `https://questline-yourname.vercel.app`.
2. **Redirect URLs**: click **Add URL** and add `https://<your app address>/account`.
   Add `http://localhost:5173/account` too if you want sign-in to work on your computer.

Email confirmation, password reset and Google sign-in all return to the `/account` page.

### 3.6 Email

Supabase sends the confirmation and password-reset emails. Its built-in sender is meant for
testing and only sends a few emails per hour **(not confirmed: check the current limit in
Authentication → Rate Limits)**. Before you invite other people, set up your own email
sender in **Authentication → Emails → SMTP Settings** (any provider such as Resend,
Postmark or your email host works).

---

## 4. Deploy the three server functions and their secrets

The functions are small programs that run on Supabase: `ai` (the AI helpers), `calendar`
(Google Calendar) and `push` (reminders when the app is closed).

### 4.1 Deploy them

```bash
npx supabase functions deploy ai
npx supabase functions deploy calendar --no-verify-jwt
npx supabase functions deploy push --no-verify-jwt
```

`calendar` and `push` need `--no-verify-jwt` because Google and the scheduler call them
without a player login; both still check the player's login themselves for everything else.

### 4.2 The one secret every function needs

`ALLOWED_ORIGINS` lists the addresses allowed to call the functions (comma-separated, no
spaces, no trailing slash):

```bash
npx supabase secrets set ALLOWED_ORIGINS=https://questline-yourname.vercel.app,http://localhost:5173
```

You can also set secrets in the dashboard: **Edge Functions → Secrets** **(not confirmed)**.
Secrets take effect without redeploying.

The other secrets are added in parts 5 to 7. `SUPABASE_URL`, `SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY` are provided by Supabase automatically; do not set them.

---

## 5. The AI helpers (Anthropic API key)

The AI breaks quests into steps, helps when you are stuck, sorts a brain dump and explains
"What should I do now?". It needs an account in the app (guests use the non-AI version).

1. Go to https://console.anthropic.com and sign up.
2. Add a payment method under **Billing** (AI requests cost a little per use). Consider a
   monthly spend limit there as well.
3. Open **API Keys → Create Key**, name it `questline`, and copy the key (it starts with
   `sk-ant-`). It is shown only once.
4. Store it as a function secret:

   ```bash
   npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   ```

Optional secrets (leave them unset to use the defaults):

| Secret                | What it does                                                          |
| --------------------- | --------------------------------------------------------------------- |
| `AI_DAILY_LIMIT`      | Requests per player per day. Default 50.                              |
| `ANTHROPIC_MODEL`     | Which model the AI uses. Leave unset for the default.                 |
| `ANTHROPIC_EFFORT`    | `low` (default), `medium` or `high`. Higher is slower and costs more. |
| `ANTHROPIC_FALLBACKS` | `on` (default) or `off`.                                              |

The key never reaches the browser: the app talks to the `ai` function, which talks to
Anthropic.

---

## 6. Google: sign-in and Calendar

One Google OAuth client can serve both "Continue with Google" and Google Calendar.

### 6.1 Create a Google Cloud project and turn on the Calendar API

1. Go to https://console.cloud.google.com and sign in.
2. At the top, open the project picker → **New Project**, name it `Questline`, **Create**,
   then make sure it is selected.
3. Open **APIs & Services → Library**, search for **Google Calendar API**, open it and
   click **Enable**.

### 6.2 The consent screen (what players see when they connect)

1. Open **APIs & Services → OAuth consent screen** (in newer consoles: **Google Auth
   Platform → Branding / Audience / Data Access**) **(not confirmed)**.
2. User type: **External**. App name `Questline`, your support email, your app address as
   the home page, and your email as the developer contact.
3. **Scopes** (Data Access) → **Add or remove scopes**, and add:
   - `openid`
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile` (for sign-in)
   - `https://www.googleapis.com/auth/calendar.readonly` (to show the day's events)
   - `https://www.googleapis.com/auth/calendar.app.created` (to manage only the
     "Questline" calendar the app creates)
4. **Test users** (Audience): while the app is in "Testing", only the Google accounts you
   list here can connect. Add your own and your testers' addresses. Calendar scopes need
   Google's verification before the app can be published to everyone; that is a separate
   process you can start later from the same page.

### 6.3 Create the OAuth client

1. Open **APIs & Services → Credentials → Create credentials → OAuth client ID**.
2. Application type: **Web application**. Name: `Questline`.
3. **Authorized JavaScript origins**: your app address (e.g.
   `https://questline-yourname.vercel.app`).
4. **Authorized redirect URIs**, add both, exactly (replace `<project-ref>`):
   - `https://<project-ref>.supabase.co/auth/v1/callback` (Google sign-in)
   - `https://<project-ref>.supabase.co/functions/v1/calendar/callback` (Google Calendar)
5. Click **Create** and copy the **Client ID** and **Client secret**.

### 6.4 Turn on Google sign-in in Supabase

In Supabase: **Authentication → Sign In / Providers → Google** **(not confirmed)**. Switch
it on, paste the Client ID and Client secret, and **Save**.

### 6.5 Give the calendar function the same client

```bash
npx supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=...
```

`GOOGLE_REDIRECT_URI` is optional; the default is the calendar callback above. Only set it
if you use a custom domain for Supabase.

---

## 7. Reminders when the app is closed (web push)

### 7.1 Make the keys

In the `questline` folder:

```bash
node supabase/scripts/generate-vapid-keys.mjs
```

It prints two lines, `VAPID_PUBLIC_KEY=...` and `VAPID_PRIVATE_KEY=...`. Make them once and
keep them: changing them later switches off notifications for everyone until they turn
them on again.

Also make a cron secret, any long random string, for example:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 7.2 Store them

```bash
npx supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... \
  VAPID_SUBJECT=mailto:you@example.com CRON_SECRET=...
```

`VAPID_SUBJECT` is an address push services can contact about problems (use your own).

### 7.3 Start the reminder scheduler

The `push` function sends due reminders when it is called; a scheduler calls it every five
minutes.

1. In Supabase, open **Database → Extensions** and enable **pg_cron** and **pg_net**.
2. Open the **SQL Editor**, paste this, replace the two placeholders, and click **Run**:

   ```sql
   select cron.schedule('questline-reminders', '*/5 * * * *', $$
     select net.http_post(
       url := 'https://<project-ref>.supabase.co/functions/v1/push',
       headers := jsonb_build_object('content-type', 'application/json',
                                     'x-cron-secret', '<CRON_SECRET>'),
       body := '{"action":"tick"}'::jsonb)
   $$);
   ```

3. To check it runs: **Integrations → Cron** (or run `select * from cron.job_run_details
order by start_time desc limit 5;` in the SQL Editor) should show a successful run every
   five minutes **(not confirmed: menu name)**.

To stop it later: `select cron.unschedule('questline-reminders');`

---

## 8. Redeploy and look

After parts 3 to 7, redeploy the app once in Vercel (**Deployments → … → Redeploy**) so it
picks up the Supabase variables, then open your app address. In **Settings** you should
now see **Account and sync** with a sign-in button, **AI helpers**, **Google Calendar** and
**Reminders**.

---

## 9. Checklist: confirm each service really works

### 9.1 First, the automatic check

The repository has a script that tests the deployed functions with your real keys: it makes
a throwaway test account, asks the real AI a few small questions, checks the Google consent
link and the push configuration, runs one reminder tick, and prints `ok` or `FAIL` for each
step, followed by what you still have to try by hand. In the `questline` folder:

```bash
SUPABASE_URL=https://<project-ref>.supabase.co \
SUPABASE_ANON_KEY=<anon key> \
APP_ORIGIN=https://<your app address> \
CRON_SECRET=<your cron secret> \
node supabase/tests/functions/check-functions.mjs
```

- `APP_ORIGIN` must be one of the addresses in `ALLOWED_ORIGINS` (part 4.2).
- The test account must be able to sign in without clicking an email link. Either switch
  off **Confirm email** for a moment (**Authentication → Sign In / Providers → Email**,
  **(not confirmed)**) and switch it back on afterwards, or run the script against a second
  "staging" Supabase project.
- It uses a few AI requests (a fraction of a cent).
- Never set `GOOGLE_FAKE_BASE` or `PUSH_ALLOW_TEST_NOW` on the real project: they are only
  for the developers' tests.

Every line should say `ok`. A `FAIL` names the step; the table below says where to look.

### 9.2 Then, by hand

Do these in order, with real accounts. Use two different browsers (or a computer and a
phone) where it says so. If a check fails, the "If not" column says where to look first.
Function logs are under **Edge Functions → (function) → Logs** in Supabase.

| #   | Check                               | How                                                                                                                                                                                                                                                                                                                                 | If not                                                                                                                                                                                                                                                                                                                                             |
| --- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Sign up and confirmation email**  | Settings → Account and sync → sign up with an email and password. An email arrives; its link opens your app on `/account` and you are signed in.                                                                                                                                                                                    | No email: check spam, then **Authentication → Logs** and the email rate limit (part 3.6). Link opens the wrong site: fix **Site URL** and **Redirect URLs** (part 3.5).                                                                                                                                                                            |
| 2   | **Password reset email**            | Sign out, choose "Forgot your password?", enter the email. The email's link opens `/account` and lets you set a new password.                                                                                                                                                                                                       | Same as check 1.                                                                                                                                                                                                                                                                                                                                   |
| 3   | **Your data moved to the account**  | The quests you made as a guest are still there after signing up.                                                                                                                                                                                                                                                                    | Check that `npx supabase db push` applied all four migrations (part 3.3).                                                                                                                                                                                                                                                                          |
| 4   | **Sync and live updates**           | Sign in with the same account in a second browser. Add a quest in one; it appears in the other within a few seconds without reloading.                                                                                                                                                                                              | Appears only after about 30 s: live updates are off. In **Database → Publications**, `supabase_realtime` must include the Questline tables (the migration adds them). Never appears: check the browser console and the Vercel variables (part 3.4).                                                                                                |
| 5   | **Google sign-in**                  | Sign out, choose **Continue with Google**, pick a Google account listed as a test user. You return to `/account` signed in.                                                                                                                                                                                                         | "redirect_uri_mismatch": the sign-in redirect URI in part 6.3 must match exactly. "Access blocked": add the account as a test user (6.2). Provider disabled: part 6.4.                                                                                                                                                                             |
| 6   | **AI helpers**                      | Signed in, open a new quest, type a title and tap **Break it down for me**. Three to seven steps appear. Settings → AI helpers shows how many requests you used today.                                                                                                                                                              | "AI helpers are turned off": switch them on again in Settings → AI helpers. "AI is not set up yet": `ANTHROPIC_API_KEY` is missing (part 5). Other errors: the `ai` function logs; check billing on the Anthropic console. A "not allowed" error in the browser console means `ALLOWED_ORIGINS` (part 4.2) does not list your app address exactly. |
| 7   | **"What should I do now?" with AI** | On Today, tap **What should I do now?**. A pick appears at once; a moment later its reason line changes to a short AI sentence.                                                                                                                                                                                                     | The pick without the AI sentence is the normal offline behaviour; see check 6.                                                                                                                                                                                                                                                                     |
| 8   | **Google Calendar**                 | Settings → Google Calendar → **Connect Google Calendar**, approve. Add a quest with a due date. In Google Calendar a "Questline" calendar appears with that quest. Open the **Day view** in the app: your own events for today show up.                                                                                             | "redirect_uri_mismatch": the calendar redirect URI (6.3). "Access blocked": test users (6.2). Error after approving: `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (6.5) and the `calendar` function logs. Calendar API disabled: part 6.1.                                                                                                          |
| 9   | **Push notifications**              | On a device that supports them (desktop Chrome, Edge or Firefox; on iPhone only after adding the app to the Home Screen), sign in, Settings → Reminders → switch on **Notifications on this device** and allow them. Add a quest due in about 70 minutes. Close the app. Within about 15 minutes a "due soon" notification arrives. | Switch says "not set up yet": the VAPID secrets (7.2). Nothing arrives: check the scheduler runs (7.3) and the `push` function logs for `tick`; check quiet hours in Settings; check the browser allows notifications for the site.                                                                                                                |
| 10  | **Install and offline**             | Open the app on a phone, use it for a minute; the app offers to install (or use the browser's "Add to Home Screen"). Turn on airplane mode and open it: everything you made is there and works.                                                                                                                                     | Make sure you are on the `https://` address; open it once online first.                                                                                                                                                                                                                                                                            |

When all ten pass, Questline is fully set up.

---

## Keeping it running

- **Updating the app**: push to the main branch; Vercel rebuilds. Players get a "A fresh
  version is ready" message with a Reload button.
- **Database changes** (new migration files): run `npx supabase db push` again.
- **Function changes**: run the three `npx supabase functions deploy` commands again.
- **Costs**: Vercel and Supabase have free tiers that fit a small group of players; AI
  requests are paid per use on the Anthropic console. Push and Google Calendar are free.
- **Developer details** (local Supabase stack, function API, how sync works) are in
  `supabase/README.md`.
