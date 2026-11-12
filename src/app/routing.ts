import type { RouteObject } from 'react-router';

/**
 * What a feature package contributes to the router. Each feature exports one of these from
 * `src/features/<feature>/routes.tsx`; src/app/router.tsx already imports every feature's
 * routes, so adding a route never means editing a shared file.
 *
 * - `shell`: pages inside the app chrome (header + tab bar / side bar). Paths are relative
 *   to "/", e.g. `{ path: 'quests/:questId', element: <QuestDetail /> }`.
 * - `fullscreen`: pages with no chrome at all (focus mode, onboarding).
 */
export interface FeatureRoutes {
  shell?: RouteObject[];
  fullscreen?: RouteObject[];
}

/** Paths of the six main tabs. Use these instead of string literals when linking. */
export const PATHS = {
  today: '/',
  quests: '/quests',
  home: '/home',
  shop: '/shop',
  stats: '/stats',
  settings: '/settings',
  focus: '/focus',
  devUi: '/dev/ui',
} as const;

/** Longest focus length accepted from a link, in minutes. */
export const MAX_FOCUS_MINUTES = 240;

export interface FocusStart {
  stepId: string;
  /** Timer length; Focus uses the player's default when absent (e.g. 5 for "just start"). */
  minutes?: number;
}

/**
 * The one way to start focus from any package: navigate to this path.
 * Focus creates and starts the session immediately on arrival (no extra tap), or resumes
 * the open session if one already exists.
 *
 *   navigate(focusPath({ stepId: step.id }))            // default length
 *   navigate(focusPath({ stepId: step.id, minutes: 5 })) // "5-minute just start"
 */
export function focusPath({ stepId, minutes }: FocusStart): string {
  const params = new URLSearchParams({ step: stepId });
  if (minutes !== undefined) params.set('minutes', String(minutes));
  return `${PATHS.focus}?${params.toString()}`;
}

/**
 * Reads a focus link's query (`location.search` or URLSearchParams). Invalid or missing
 * values come back as null: `minutes` must be a whole number from 1 to MAX_FOCUS_MINUTES.
 */
export function parseFocusSearch(search: string | URLSearchParams): {
  stepId: string | null;
  minutes: number | null;
} {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const stepId = params.get('step')?.trim() || null;
  const raw = params.get('minutes');
  const n = raw !== null && /^\d+$/.test(raw.trim()) ? Number(raw) : NaN;
  const minutes = Number.isInteger(n) && n >= 1 && n <= MAX_FOCUS_MINUTES ? n : null;
  return { stepId, minutes };
}
