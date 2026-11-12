# Contributing to Questline

This is the contract every package builds on. Read it before you write code. If something
you need is not covered, say so in your report instead of editing a file you do not own.

- Product rules: `docs/PLAN.md` (source of truth) and `docs/PRODUCT.md`.
- Database tables and fields: `docs/DATA_MODEL.md`.

## Commands

| Command             | What it does                                                                    |
| ------------------- | ------------------------------------------------------------------------------- |
| `npm run dev`       | Dev server on http://localhost:5173 (no service worker)                         |
| `npm run build`     | Type check + production build into `dist/`                                      |
| `npm run preview`   | Serve `dist/` on http://localhost:4173                                          |
| `npm run lint`      | ESLint (0 warnings), Prettier check, and the logical-CSS (RTL) check            |
| `npm run typecheck` | `tsc -b` (strict)                                                               |
| `npm test`          | Vitest unit tests (jsdom + fake-indexeddb)                                      |
| `npm run e2e`       | Playwright at phone (390x844) and desktop (1280x800); builds and serves the app |
| `npm run format`    | Prettier write                                                                  |
| `npm run icons`     | Re-render PWA PNG icons from `public/favicon.svg`                               |

All five of lint, typecheck, test, build and e2e must pass before a package is handed in.
Playwright uses the container's Chromium at `/opt/pw-browsers/chromium` when it exists. Do
not run `playwright install`. If port 4173 already has a server, Playwright reuses it, so
stop stale `vite preview` processes before `npm run e2e`.

## Folder layout

```
src/
  domain/      Pure rules engine. No React, Dexie, i18n, clock or Math.random (lint enforced).
  data/        Dexie schema, row types, repositories, live-query hooks, outbox. Import from '@/data'.
  services/    Shared operations: event bus, rewards (grantReward/spendGold), progress
               (completeStep/completeQuest). Import from '@/services'.
  ui/          Design system: tokens (styles.css) and components. Import from '@/ui'.
  i18n/        i18next setup, locales/<lang>/<namespace>.json, formatting helpers.
  app/         Shell, router, preferences store, error boundary, PWA prompt, /dev/ui gallery.
  features/    One folder per feature area (below).
  art/         (Game) layered SVG art for avatar, cottage and items.
  test/        Test helpers (resetAll for a fresh database).
e2e/           Playwright specs. One spec file per package: e2e/<package>.spec.ts.
supabase/      (Cloud) migrations and edge functions.
```

## Who owns what

| Package | Owns (create and edit freely)                                                                                                                                     |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quests  | `src/features/quests/**`, `src/features/today/**`, `src/i18n/locales/*/quests.json`, `src/i18n/locales/*/today.json`, `e2e/quests.spec.ts`                        |
| Focus   | `src/features/focus/**`, `src/i18n/locales/*/focus.json`, `e2e/focus.spec.ts`, focus audio assets                                                                 |
| Game    | `src/features/game/**`, `src/art/**`, `src/i18n/locales/*/game.json`, `e2e/game.spec.ts`                                                                          |
| Cloud   | `src/features/cloud/**`, `src/data/sync/**` (new), `supabase/**`, `src/i18n/locales/*/cloud.json`, `e2e/cloud.spec.ts`                                            |
| Finish  | `src/features/stats/**`, `src/features/settings/**`, `src/features/insights/**`, `src/features/onboarding/**`, their locale files, `docs/SETUP.md`, Vercel config |

Shared files owned by Foundation (`src/domain`, `src/data`, `src/services`, `src/ui`,
`src/i18n/*.ts`, `src/app`, `common.json`, `settings.json`, `dev.json`, configs, this file):

- **Do not edit** them, with these exceptions:
  - `src/services/events.ts`: you may add your package's events to `AppEvents`, inside your
    package's block only.
  - `src/data/db.ts` and `src/data/types.ts`: only Cloud may add fields or a new
    `version(n)`; any other package that needs a schema change asks for it in its report.
  - `src/domain/*`: if a rule is wrong or missing, add a new pure function with tests in a
    new file `src/domain/<topic>.ts` and export it from `src/domain/index.ts` (one line).
  - `src/ui/*`: add new shared components only if two packages need them; otherwise keep
    components in your feature folder.
- Lint enforces that feature folders import other features only through their public files:
  `slots.tsx`, `routes.tsx`, `settings.tsx`. Never import another feature's internals.

## Slots: how packages appear in shared screens

The shell and shared pages already render a placeholder component from each package. Keep
the export name and replace the body. No shared file needs editing.

| Slot                             | File                                                   | Rendered by                                 |
| -------------------------------- | ------------------------------------------------------ | ------------------------------------------- |
| `QuickCaptureSlot`               | `features/quests/slots.tsx`                            | header (global "+", `Q` shortcut)           |
| `OverduePromptSlot`              | `features/quests/slots.tsx`                            | shell, once                                 |
| `ActiveSessionSlot`              | `features/focus/slots.tsx`                             | top of every shell page                     |
| `AvatarBadge`                    | `features/game/slots.tsx`                              | header (takes `size` in px)                 |
| `DailyQuestsSlot`                | `features/game/slots.tsx`                              | Today board                                 |
| `RewardEffectsSlot`              | `features/game/slots.tsx`                              | app root, on every route (incl. focus mode) |
| `SyncStatusSlot`                 | `features/cloud/slots.tsx`                             | header                                      |
| `EnergyCheckSlot`, `WhatNowSlot` | `features/insights/slots.tsx`                          | Today board                                 |
| `OnboardingGate`                 | `features/onboarding/slots.tsx`                        | app root                                    |
| `SettingsSection`                | `features/{quests,focus,game,cloud}/settings.tsx`      | Settings page                               |
| `setup()`                        | `features/{quests,focus,game,cloud,insights}/setup.ts` | once at start, after the DB is ready        |

The Today page (`features/today/TodayPage.tsx`) belongs to Quests and already places the Game
and Insights slots; keep them when you rebuild it.

## Adding a route

Edit only your own `src/features/<feature>/routes.tsx`. It exports a `FeatureRoutes` object:

```tsx
export const routes: FeatureRoutes = {
  shell: [{ path: 'quests/:questId', element: <QuestDetailPage /> }], // inside header + nav
  fullscreen: [{ path: 'focus/:sessionId?', element: <FocusPage /> }], // no chrome at all
};
```

Paths are relative to `/`. Use `PATHS` from `src/app/routing.ts` for the main tabs. Each
page should render `<Page title=...>` from `@/ui` (it provides the `h1`). Full-screen pages
render their own `<main id="main">`. `/dev/ui` is reserved for the gallery.

## i18n

- Every user-visible string goes through i18next. Real Persian translations ship with every
  English string: a unit test fails if `fa` and `en` keys differ or a value is empty.
- One namespace per package, already created and registered: `today`, `quests`, `focus`,
  `game`, `cloud`, `stats`, `insights`, `onboarding` (plus Foundation's `common`, `settings`,
  `dev`). Add keys to `src/i18n/locales/en/<ns>.json` and `src/i18n/locales/fa/<ns>.json`.
  Never add keys to another package's file or to `common.json`.
- Use `const { t } = useTranslation('quests')` and `t('form.title')`. Keys are typed from
  the English files, so a typo is a type error.
- Plurals: `key_one` and `key_other` in both languages; call `t('key', { count })`.
- Numbers, dates, times and durations: `useFormat()` from `@/i18n/useFormat` (Persian digits
  and the Jalali calendar for `fa`). Never print a number or date with `String()` or
  `toLocaleString()` directly. Timer text: `format.timer(ms)`.
- Day keys (`LocalDate`, "2026-03-10") are for storage and logic only; format them for display.

## Styling and RTL

- Use the design tokens through Tailwind: `bg-surface`, `bg-surface-2`, `text-text`,
  `text-muted`, `text-primary`, `bg-xp`, `text-gold-text`, `border-border`, `rounded-lg`,
  `shadow-md`, ... (see `@theme` in `src/ui/styles.css`). No raw hex colors in features
  except inside SVG art; art should prefer `var(--ql-*)` so it follows the theme.
- Logical properties only: `ps-*`/`pe-*`, `ms-*`/`me-*`, `start-*`/`end-*`, `text-start`,
  `border-s`, `rounded-s-*`. `npm run lint` fails on `pl-`, `mr-`, `left-`, `text-left`...
  Icons that point forward/back mirror automatically (`chevron-forward`, `arrow-forward`).
- Motion: keep animations short and calm; `data-motion="reduce"` on `<html>` disables them
  globally. For JS-driven motion read `usePreferences(s => s.resolved.reduceMotion)` from
  `src/app/preferences/preferences.ts`. Sound: `usePreferences(s => s.sound)`; haptics:
  `usePreferences(s => s.haptics)`.
- Text must survive "larger" text size, the dyslexia font and Persian at 390px wide with no
  horizontal scroll. Use `min-w-0` and `truncate` in flex rows.
- Use components from `@/ui` (Button, IconButton, Card, Dialog/Sheet/Modal, Input, Textarea,
  Select, Chip, ToggleChip, Tabs, ProgressBar, showToast, Toggle, SegmentedControl,
  EmptyState, Icon, Page, Section, Spinner). See them all at `/dev/ui`. For a router
  `<Link>` that looks like a button use `className={buttonClass('primary')}`.

## Data layer

- Read with the hooks in `@/data` (`useQuestsByStatus`, `useSteps`, `useSettings`,
  `usePlayerStats`, `useOpenFocusSession`, ...) or write your own with `useLiveQuery`.
  Every hook returns `undefined` while loading.
- Write only through repositories (`questsRepo.create/update/remove`, `createQuest`, ...).
  They stamp `id`, `user_id`, `created_at`, `updated_at`, soft-delete with `deleted_at`, and
  add the sync outbox entry in the same transaction. Never call `db.<table>.put/add/delete`
  directly from feature code. Never hard-delete.
- Reads must skip rows with `deleted_at` set (repositories and hooks already do).
- Several writes for one user action: wrap them in
  `writeTransaction(['quests', 'steps'], async () => { ... })` so they commit together.
- Time: use `clock.now()` / `clock.iso()` / `clock.today()` from `@/data` (tests freeze it
  with `setClock`), `useNow()` / `useToday()` in components. Domain functions take time as a
  parameter. Timestamps are stored as ISO strings; convert with `toMs` / `toIso`, and use
  `sessionToTimerState(session)` to feed `src/domain/timer.ts`.
- Singletons (`settings`, `profile`, `streak_state`, `notification_prefs`) are created at
  start-up by `ensureLocalData()`. Use `getSettings()` / `updateSettings(patch)` etc.
- Level, XP, gold and streak are never stored. They are derived from `ledger_events`
  (`usePlayerStats()`, `getPlayerStats(day)`).

## Rewards: one way for everyone

Never write to `ledger_events` yourself. Use `@/services`:

- `completeStep(stepId, { sessionId?, confirmedWithoutTimer? })`: marks the step done,
  touches the quest, pays the step's share of the 60% pool (loot roll included), and, if it
  was the last open step, finishes the quest (40% finish bonus, +25% for bosses, rare loot
  roll). Used by both Quests (checkbox) and Focus (Done button). Pass `sessionId` when done
  inside a focus session.
- `completeQuest(questId)`: finishes a quest; open steps are checked off and paid first.
- `reopenStep(stepId)`: un-checks; rewards already paid are kept and never paid twice.
- `grantReward({ kind: 'focus_bonus', sessionId })`: after a focus session has ended and
  `focused_ms` is saved (+1 XP per 5 min, doubled if `double_xp`).
- `grantReward({ kind: 'daily_quest', dailyQuestId })`: Game, when a daily quest completes.
- `grantReward({ kind: 'fixed', ledgerKind: 'achievement', sourceType: 'achievement',
sourceId, dedupeKey: 'achievement:<id>', reward })`: achievements and other fixed amounts.
- `spendGold({ amount, sourceType: 'shop_item' | 'user_reward', sourceId, dedupeKey })`:
  purchases; throws `InsufficientGoldError` instead of going negative.
- `configureRewards({ rareItemIds: () => [...] })`: Game registers its rare cosmetics in
  its `setup()`; dropped items are added to `inventory` automatically.

Every grant is idempotent (ledger `dedupe_key`), pays level-up gold gifts for each level
crossed (`level:<n>`), keeps `streak_state.best` current, and returns a `GrantResult`
(`total`, `levelUps`, `loot`, `xpBefore`, `xpAfter`) for animations. Randomness is injected
(`{ rng }`) so tests are deterministic.

## Events: reacting to other packages

`events.on(name, handler)` (or `useAppEvent(name, handler)` in components) from
`@/services`. Payload types are in `src/services/events.ts`.

| Event                                                                                       | Emitted by                        | Typical listener                                       |
| ------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------ |
| `step.completed`, `quest.completed`, `step.reopened`                                        | services (via completeStep/Quest) | Game (achievements, daily quests), Quests (recurrence) |
| `reward.granted`, `level.up`, `loot.dropped`, `gold.spent`                                  | services                          | Game (effects, sounds)                                 |
| `quest.created/activated/deactivated/archived/became_boss/overdue_answered`, `inbox.sorted` | Quests                            | Game, Cloud (calendar)                                 |
| `session.started`, `session.ended`, `distraction.logged`                                    | Focus                             | Game, Finish (stats)                                   |
| `achievement.unlocked`, `daily_quest.completed`, `power_up.used`                            | Game                              | Finish                                                 |
| `energy.checked_in`                                                                         | Finish                            | Game (daily quest)                                     |

Emit events about saved data with `events.emitAfterCommit(...)` inside your transaction, so
listeners never see changes that were rolled back. Listeners must not throw and must not
assume order between packages.

## Tests

- Domain: exhaustive unit tests next to the module (`src/domain/*.test.ts`).
- Data and services: use `resetAll()` from `@/test/db` in `beforeEach`, freeze time with
  `setClock`, pass a seeded `Rng` (`sequenceRng`, `createRng`) to anything that rolls.
- E2E: one spec per package, run at both sizes; check English and Persian and
  `expectNoHorizontalScroll`. Use roles and accessible names, `data-testid` only as a last
  resort. Run with `--trace off`.

## Git

Work on your package branch/worktree; small logical commits. No AI model names anywhere.
