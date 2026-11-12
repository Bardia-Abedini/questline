# Questline

An RPG-style task app for people with ADHD: real tasks become quests made of tiny steps,
started in two taps, rewarded right away, and never punished. Installable web app (PWA),
English and Persian (right to left), light and dark, local-first.

## Run it

Requires Node 20.19 or newer.

```bash
npm install
npm run dev        # http://localhost:5173
```

The app runs fully in guest mode with no keys: everything is stored in the browser.
Accounts and sync are optional; copy `.env.example` to `.env.local` and fill in
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` when the Cloud features are set up
(see `docs/SETUP.md`, written in a later package).

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

## Docs

- `docs/PLAN.md`: the approved product and build plan (source of truth for every rule).
- `docs/PRODUCT.md`: the original product note.
- `docs/CONTRIBUTING.md`: folder layout, ownership, slots, routes, i18n, rewards, events.
- `docs/DATA_MODEL.md`: every table and field in the local database.
