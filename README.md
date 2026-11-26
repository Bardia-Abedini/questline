# Questline

An RPG-style task app for people with ADHD: real tasks become quests made of tiny steps,
started in two taps, rewarded right away, and never punished. Installable web app (PWA),
English and Persian (right to left, Jalali dates), light and dark, local-first.

What is in it:

- **Quests and steps**: priorities, difficulty ranks, time guesses, due dates, categories,
  tags, recurring quests, templates, quick capture (`Q`), an Inbox and a backlog.
- **Today board**: the Active quests (up to a limit) with a big Continue button, a one-tap
  energy check, "What should I do now?", daily quests and a weekly recap.
- **Focus mode**: a timer that survives closing the app, breaks, gentle distraction
  nudges, ambience sounds and a session history.
- **Game**: XP, levels, gold, a shop with real-life rewards, power-ups, an avatar and a
  cottage, achievements, boss quests and a streak that never resets.
- **Stats**: focus time, steps and quests finished, best time of day, when distractions
  show up, guess versus real time, XP over time.
- **Optional online services**: accounts and sync (Supabase), AI helpers, Google Calendar
  and Google sign-in, and reminders by web push.

## Run it

Requires Node 20.19 or newer.

```bash
npm ci
npm run dev        # http://localhost:5173
```

The app runs fully in guest mode with no keys: everything is stored in the browser and
works offline. The build needs no environment variables. To turn on accounts, sync, AI,
Google Calendar and push, follow **`docs/SETUP.md`** (written for the owner, step by step,
including deployment to Vercel).

## Scripts

| Command             |                                                                |
| ------------------- | -------------------------------------------------------------- |
| `npm run dev`       | Development server                                             |
| `npm run build`     | Type check and production build (`dist/`, with service worker) |
| `npm run preview`   | Serve the production build on http://localhost:4173            |
| `npm run lint`      | ESLint, Prettier check, RTL (logical CSS) check                |
| `npm run typecheck` | TypeScript, strict                                             |
| `npm test`          | Unit tests (Vitest)                                            |
| `npm run e2e`       | End-to-end tests (Playwright, phone and desktop sizes)         |

The hidden page `/dev/ui` shows every design-system component in both themes and both
reading directions.

## Deploy

`vercel.json` configures a static Vite build on Vercel: every route falls back to the app,
the service worker is never cached, and hashed assets are cached for a year. See
`docs/SETUP.md` part 2.

## Docs

- `docs/SETUP.md`: setting up and deploying everything, with a checklist to verify each
  online service.
- `docs/PLAN.md`: the approved product and build plan (source of truth for every rule).
- `docs/PRODUCT.md`: the original product note.
- `docs/CONTRIBUTING.md`: folder layout, ownership, slots, routes, i18n, rewards, events.
- `docs/DATA_MODEL.md`: every table and field in the local database.
- `supabase/README.md`: the backend for developers (migrations, functions, local stack).
