/**
 * Step rules (plan sections 1 and 4).
 */

/** A step with a guess of this many minutes or less counts as quick when AI is not available. */
export const QUICK_STEP_MAX_MINUTES = 5;

/** Fallback `quick` rule (guest/offline): guess of 5 minutes or less. No guess means not quick. */
export function isQuickByRule(guessMinutes: number | null | undefined): boolean {
  return typeof guessMinutes === 'number' && Number.isFinite(guessMinutes) && guessMinutes > 0
    ? guessMinutes <= QUICK_STEP_MAX_MINUTES
    : false;
}

/**
 * First-step rule: a gentle (never blocking) suggestion to split the first step when its
 * guess is over 5 minutes.
 */
export function shouldSuggestSplittingFirstStep(guessMinutes: number | null | undefined): boolean {
  return typeof guessMinutes === 'number' && guessMinutes > QUICK_STEP_MAX_MINUTES;
}

/** A quest saved with no steps gets one step named after the quest, with the quest's guess. */
export function defaultStepFor(quest: { title: string; guess_minutes: number | null }): {
  title: string;
  guess_minutes: number | null;
  quick: boolean;
} {
  return {
    title: quest.title,
    guess_minutes: quest.guess_minutes,
    quick: isQuickByRule(quest.guess_minutes),
  };
}

/**
 * Whether checking off a step should show the one-time "did you really finish it?" warning:
 * only for non-quick steps with no focus session on them, and only once per step.
 */
export function needsNoTimerWarning(step: {
  quick: boolean;
  hadFocusSession: boolean;
  alreadyWarned: boolean;
}): boolean {
  return !step.quick && !step.hadFocusSession && !step.alreadyWarned;
}
