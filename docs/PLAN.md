# Questline — ADHD Quest RPG: full product and build plan

## Context

The repo `questline` is empty. We are building, from scratch, an RPG-style task app for
students and adults with ADHD: real tasks become quests, split into tiny steps, started in
2 taps, rewarded instantly, and never punished. This plan fixes every product decision made
with the user during planning, then describes how the build is delegated (senior developers,
junior developers, and a lead who reviews only and writes no code).

## Decisions made with the user

| Topic | Decision |
|---|---|
| Platforms | One responsive, installable web app (PWA). Native wrappers later. |
| Backend | Supabase (Postgres, auth, realtime, edge functions). |
| Sign-in | Guest first (local data); sign up later with email+password or Google, which uploads data and turns on sync. |
| Setup | Build with no keys; app runs fully in guest mode. User plugs in Supabase / Anthropic / Google keys at the end from a written guide. |
| Hosting | Vercel (static build + auto deploy). |
| Style | Cozy / soft fantasy, light and dark themes. |
| Languages | English and Persian (RTL, Vazirmatn font, Jalali dates when Persian). |
| Accessibility | Reduced motion, dyslexia-friendly font, larger text, sound/haptics toggles, keyboard navigation. |
| Home screen | Today board. |
| Social | Not built now; schema shaped so friends/parties/leaderboards slot in later. |

## Feature specification

### 1. Quests and steps
- Quest fields: title, notes, steps, priority (high/medium/low), difficulty (E, D, C, B, A, S),
  time guess, optional due date/time, category, tags, recurrence, status
  (inbox / backlog / active / done / archived).
- Steps optional: a quest saved with none gets one step named after the quest.
- Each step: title, time guess, `quick` flag (can be done without a timer), done state, actual time.
- First-step rule: if the first step's guess is over 5 minutes, the form gently suggests
  splitting it (one tap asks AI to shrink it). Not blocking.
- Categories (School, Home, Personal by default; editable, color + icon), free tags, search and
  filters in the backlog.
- Recurring quests (daily / weekly / chosen weekdays / every N days): the next occurrence is
  created when the current one is finished or its day passes. Missed occurrences never pile up.
- Templates: save any quest as a template; new quest from template pre-fills steps.
- Quick capture: global "+" and keyboard shortcut (`Q`), one line, lands in an Inbox to sort
  later. Available inside focus mode.

### 2. Active Quests and the Today board
- Active limit: default 3, adjustable 1 to 5 in settings.
- Starting a quest beyond the limit opens a swap sheet: pick one active quest to send back to
  the backlog (progress kept), one tap swaps and starts.
- Active list ordered by priority, then due date, then last touched.
- Today board: slim header (avatar, level, XP bar, gold, streak), Active Quests with a big
  Continue button on the top one (tap quest, tap Start = 2 taps), daily quests, energy check,
  "What should I do now?" button.
- Navigation: Today, Quests (backlog/inbox/done/archive), Home (avatar + cottage), Shop,
  Stats, Settings. Bottom tab bar on phones, side bar on desktop.

### 3. Focus timer and focus mode
- Default 25 min focus / 5 min break. Presets 10, 15, 25, 45 plus custom. A "5-minute just
  start" option is offered on first steps.
- Focus mode hides everything except timer, quest title, current step, next step, and the
  buttons: Done, Pause, I got distracted, Quick capture, Stop.
- Timer end: chime, focus-bonus XP, break offered, one tap continues the same step with a new
  timer. Steps are only done when the user says so; finishing early is always allowed.
- Timer is based on stored start timestamps, not a running counter, so closing the app
  mid-timer and reopening restores the session (or shows "your timer ended while you were
  away" with the same choices). Synced, so it restores on another device too.
- Optional 3-second session-start pledge ("phone away, tabs closed"), skippable, off by default
  so the 2-tap start holds.
- Ambience: rain, cafe, lo-fi-style loop, brown noise (generated/CC0 audio), volume control;
  a study companion sits beside the avatar in focus mode.
- History: every session logged (quest, step, start, end, focused time, time away, distractions).

### 4. Completing a step without the timer
- Every step has a `quick` flag. AI sets it when steps are created (breakdown, brain dump, or
  a light classification call on manual steps). Without AI (guest/offline): `quick` = guess of
  5 minutes or less.
- Quick step checked off directly: full reward, no prompt.
- Non-quick step checked off with no session: a one-time friendly warning ("This one looks
  like it needs focus time. Did you really finish it?") with "Yes, I did it" and "Start timer".
  Confirming gives the full reward. Never blocked.

### 5. Distraction alerts
- Left-the-app nudge: during a session, if the tab is hidden or the window unfocused longer
  than a set threshold (default 60 s), a notification + sound names the step and offers a
  return. Time away is recorded, never penalized.
- Idle check-in: long after the timer ended with no input, "Still on it?" with Done / Still
  going / I got pulled away.
- "I got distracted" button: parks a thought in a quick note (goes to Inbox) and logs it.
- Stats show when distractions cluster.

### 6. Rewards and economy
- Difficulty base rewards (XP / gold): E 20/10, D 40/20, C 80/40, B 150/75, A 300/150, S 600/300.
- 60% split evenly across steps as each is done (rounding remainder on the last step), 40% as
  a finish bonus.
- Focus bonus: +1 XP per 5 focused minutes in a timed session.
- Level curve: XP needed for next level = 100 + 50 x (level - 1). Each level gives a gold gift;
  milestone levels (5, 10, 15, ...) upgrade the cottage exterior and unlock shop items and titles.
- Every reward shows instantly: sound, XP bar animation, floating numbers (respects reduced motion).
- Loot drops: about 15% chance on step completion of bonus gold; small chance of a rare
  cosmetic on quest completion.
- Achievements: badges for milestones (first quest, 10 sessions, first S-rank, boss defeated,
  7-day streak, accurate estimator, ...). Around 30 at launch.
- Forgiving streak: a day counts with one finished step. A missed day makes the streak "rest";
  it resumes on return and never drops to zero. Best streak is kept.
- Daily quests: three small optional goals per day from a pool, small gold bonus, reroll with
  a power-up. No penalty for skipping.
- Boss quests: any S-rank quest, or a quest untouched for 14+ days, can be turned into a boss:
  a health bar that each finished step damages, a larger finish bonus (+25%) and a badge.

### 7. Shop, avatar and cottage
- Shop tabs: My Rewards (user-defined real-life rewards with a gold price; buying moves it to
  an inventory to redeem), Cosmetics, Power-ups.
- Power-ups: streak rest token, double-XP potion (one session), daily-quest reroll.
- Avatar: skin, hair, outfit, hat, accessory slots, about 30 items.
- Cottage: one room with about 10 decoration slots and about 40 items, a pet slot, exterior
  that upgrades at level milestones. Pets never get sad or sick.
- All art is layered SVG drawn in code; sounds are synthesized or CC0.

### 8. Time estimates
- Guess entered per quest (and per step when steps exist). On completion the actual time is
  shown next to the guess, framed neutrally.
- Trainer: tracks the personal ratio of actual to guess (overall and per category) and, when
  adding a quest, offers "you usually take about 1.8x; use 45 min instead?".

### 9. Overdue handling
- When a due time passes, the quest is flagged once. On next open, a single prompt per quest:
  "Can this still be done?" Yes keeps it (optionally pick a new date); No archives it.
  Never asked twice, no red badges, no lost XP.

### 10. AI (server-side through a Supabase edge function, Claude API)
- Break it down: on the add/edit form, proposes 3 to 7 tiny steps with guesses and quick
  flags, first step under 5 minutes. User edits, reorders, deletes, regenerates, then saves.
- "I'm stuck" on a step: splits it smaller.
- Auto priority and difficulty suggestions when adding a quest, always overridable.
- Brain dump: paste a messy list; AI returns separate quests with steps, priority, difficulty
  and guesses for review before saving.
- "What should I do now?": picks one quest using due date, priority, guess, and current
  energy. Works without AI through a local scoring rule; AI adds a one-line reason.
- Per-user daily request limit; AI needs an account. Everything degrades gracefully without it.
- Replies in the user's language (English or Persian).

### 11. Calendar (Google, two-way)
- Connect Google in settings. Quests with due dates and planned focus blocks are written to a
  dedicated "Questline" calendar; edits and deletions follow.
- The user's existing events are read into an in-app day view to show free time; a focus block
  can be planned in a gap.
- Tokens stay server-side in an edge function.

### 12. Reminders and notifications
- Web push (needs an account) plus in-app notifications: due soon, a chosen daily "time to
  quest" nudge, "you left a quest paused".
- Quiet hours, per-type switches, all off by default except due-soon.

### 13. Energy check, stats and recap
- One-tap energy (low / medium / high) on the Today board; feeds "What should I do now?".
- Stats: focus time per day/week, steps and quests done, best time of day, distraction
  patterns, estimate accuracy, XP over time.
- Weekly recap: short, wins only.

### 14. Accounts, sync, data
- Local-first: all data lives in the browser database and the app works offline. With an
  account, changes sync both ways and in near real time across devices.
- Guest to account: signing up uploads local data; signing in on a device with guest data
  offers to merge.
- Settings: export all data (JSON), delete account and data.
- Onboarding: 4 short screens, create avatar, add first quest, run a first 5-minute session.

### Later phase (planned, not built now)
Friends by code, parties with a shared weekly goal, friends-only weekly leaderboards;
Tauri desktop and Capacitor phone wrappers.

## Technical design

- Vite + React + TypeScript, Tailwind CSS with design tokens (cozy palette, light/dark),
  React Router, Zustand for UI state.
- Local database: Dexie (IndexedDB). Every table row has `id` (UUID), `updated_at`,
  `deleted_at`, `user_id`. Sync engine: outbox of local changes pushed to Supabase, pull by
  `updated_at`, realtime subscription, last-write-wins per row; XP/gold kept as an append-only
  ledger of reward events so totals never conflict.
- Domain logic (rewards, levels, streaks, loot, recurrence, estimate ratio, next-quest scoring)
  as pure functions in `src/domain/`, fully unit tested, random rolls seeded for tests.
- Supabase: SQL migrations with row-level security on every table; edge functions
  `ai` (Claude), `calendar` (Google OAuth + sync), `push` (web push, scheduled).
- PWA via vite-plugin-pwa (offline shell, install prompt, notification handling).
- i18next with `en` and `fa`, logical CSS properties for RTL.
- Recharts for stats. Vitest + Testing Library for units, Playwright for end-to-end.
- Layout: `src/app` (shell, routes), `src/features/<feature>`, `src/domain`, `src/data`
  (Dexie, sync), `src/ui` (design system), `src/art` (SVG avatar, cottage, items),
  `src/i18n`, `supabase/` (migrations, functions), `e2e/`, `docs/SETUP.md`.

## Build organization

The lead writes briefs, reviews, runs the app and tests, sends corrections. The lead
writes no code, including scaffolding and fixes. Every coding agent is a senior
developer; each senior may spawn junior developers for well-bounded pieces
(item art, translations, tests, individual screens) and is responsible for their output.

1. **Foundation (one senior, alone, first):** project scaffold, design system and core
   components, Dexie schema and typed repositories, the whole `src/domain` rules engine with
   tests, app shell with navigation, i18n and theme plumbing, test tooling. This fixes the
   contracts everyone else builds on. Reviewed and merged before step 2.
2. **Four seniors in parallel, each in its own git worktree:**
   - **Quests:** quest/step CRUD, Today board, backlog/inbox/archive, active limit and swap
     sheet, overdue prompt, categories/tags/search, recurring, templates, quick capture.
   - **Focus:** timer, focus mode, breaks, restore after close, distraction alerts, pledge,
     ambience, session history, estimate trainer, no-timer completion warning.
   - **Game:** reward ledger wiring, level-ups, shop (three tabs), inventory, power-ups, loot,
     achievements, streak, daily quests, boss quests, avatar editor, cottage, art, sounds.
   - **Cloud:** Supabase migrations and RLS, auth and guest-to-account merge, sync engine,
     edge functions for AI, calendar and push, plus the AI and calendar UI hooks.
3. **One senior for the finish:** stats and weekly recap, energy check and
   "What should I do now?", settings, onboarding, accessibility pass, full Persian
   translation and RTL pass, PWA polish, Vercel config, `docs/SETUP.md`.
4. **Review loop after every package:** The lead reads the diff, runs lint, type check, unit tests
   and the Playwright suite, drives the app in the browser at phone and desktop sizes, and
   returns a numbered list of defects and improvements to the same agent. Repeats until clean,
   then the package is merged into `claude/loving-cerf-g1w3wx` and pushed.
5. **Final report to the user:** what was built, test results, anything that could not be
   verified, and the setup guide. The user is only contacted earlier for a true blocker.

## Verification

- `npm run lint`, `npm run typecheck`, `npm test` (domain rules: reward split 60/40 with
  rounding, level curve, streak rest, recurrence, estimate ratio, quick-step rule).
- Playwright end-to-end at phone and desktop sizes, in English and Persian: add quest with no
  steps (gets one step), 2-tap start, timer end and break, close and reopen mid-timer restores
  the session, step done pays XP/gold, quest finish pays the 40% bonus, 4th quest swap sheet,
  overdue asked once then archived, buy and redeem a reward, non-quick step warning,
  offline use then reload.
- Cloud: migrations, RLS and sync tested against a local Supabase stack if Docker is available
  in the build container; otherwise against mocks, and the final report says so plainly. AI,
  Google Calendar and web push with real keys can only be confirmed after the user completes
  `docs/SETUP.md`; the report lists these as not yet verified live.
- Screenshots of the main screens (light/dark, English/Persian) included in the final report.
