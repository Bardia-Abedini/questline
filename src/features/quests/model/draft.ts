/**
 * The add/edit quest form works on a draft: plain strings for what the player types, so
 * nothing is parsed until saving. These helpers are pure (no React, no database).
 */
import { isQuickByRule } from '@/domain/steps';
import type { Difficulty, Priority } from '@/domain/types';
import type { QuickSource, RecurrenceRule, Uuid } from '@/data/types';

export interface StepDraft {
  /** Stable key for React lists and focus management. */
  key: string;
  /** Existing step id when editing. */
  id?: Uuid;
  title: string;
  /** Minutes as typed (may use Persian digits). */
  guess: string;
  quick: boolean;
  quickSource: QuickSource;
  done: boolean;
}

export type RecurrenceChoice = 'none' | 'daily' | 'weekly' | 'weekdays' | 'every_n_days';

export interface RecurrenceDraft {
  kind: RecurrenceChoice;
  /** 0 = Sunday ... 6 = Saturday. */
  weekdays: number[];
  /** "every N days", as typed. */
  interval: string;
}

export interface QuestDraft {
  title: string;
  notes: string;
  priority: Priority;
  difficulty: Difficulty;
  guess: string;
  /** `YYYY-MM-DD` or empty. */
  dueDate: string;
  /** `HH:mm` or empty. */
  dueTime: string;
  categoryId: Uuid | null;
  tagIds: Uuid[];
  steps: StepDraft[];
  recurrence: RecurrenceDraft;
}

let keySeq = 0;
export function newKey(): string {
  keySeq += 1;
  return `s${keySeq}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyDraft(): QuestDraft {
  return {
    title: '',
    notes: '',
    priority: 'medium',
    difficulty: 'C',
    guess: '',
    dueDate: '',
    dueTime: '',
    categoryId: null,
    tagIds: [],
    steps: [],
    recurrence: { kind: 'none', weekdays: [], interval: '2' },
  };
}

const DIGITS: Record<string, string> = {};
'۰۱۲۳۴۵۶۷۸۹'.split('').forEach((d, i) => (DIGITS[d] = String(i)));
'٠١٢٣٤٥٦٧٨٩'.split('').forEach((d, i) => (DIGITS[d] = String(i)));

/** Latin digits for anything typed with Persian or Arabic-Indic digits. */
export function toLatinDigits(text: string): string {
  return text.replace(/[۰-۹٠-٩]/g, (d) => DIGITS[d] ?? d).replace(/[٫,]/g, '.');
}

/** Minutes typed by the player: a positive whole number up to 24 h, or null. */
export function parseMinutes(text: string): number | null {
  const clean = toLatinDigits(text).trim();
  if (!/^\d+(\.\d+)?$/.test(clean)) return null;
  const n = Math.round(Number(clean));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(n, 24 * 60);
}

export function minutesText(minutes: number | null | undefined): string {
  return typeof minutes === 'number' && minutes > 0 ? String(minutes) : '';
}

/* ------------------------------------------------------------- step list */

export function makeStep(
  title = '',
  guessMinutes: number | null = null,
  quick?: boolean,
  quickSource: QuickSource = quick === undefined ? 'rule' : 'ai',
): StepDraft {
  return {
    key: newKey(),
    title,
    guess: minutesText(guessMinutes),
    quick: quick ?? isQuickByRule(guessMinutes),
    quickSource,
    done: false,
  };
}

export function addStep(steps: StepDraft[], step: StepDraft, index = steps.length): StepDraft[] {
  const next = steps.slice();
  next.splice(Math.max(0, Math.min(index, steps.length)), 0, step);
  return next;
}

export function removeStep(steps: StepDraft[], key: string): StepDraft[] {
  return steps.filter((s) => s.key !== key);
}

/** Moves a step one place up (-1) or down (+1). Out-of-range moves do nothing. */
export function moveStep(steps: StepDraft[], key: string, delta: -1 | 1): StepDraft[] {
  const i = steps.findIndex((s) => s.key === key);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= steps.length) return steps;
  const next = steps.slice();
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

export function updateStepTitle(steps: StepDraft[], key: string, title: string): StepDraft[] {
  return steps.map((s) => (s.key === key ? { ...s, title } : s));
}

/** Changing the guess re-applies the offline quick rule unless the player set `quick` themselves. */
export function updateStepGuess(steps: StepDraft[], key: string, guess: string): StepDraft[] {
  return steps.map((s) => {
    if (s.key !== key) return s;
    const quick = s.quickSource === 'user' ? s.quick : isQuickByRule(parseMinutes(guess));
    return { ...s, guess, quick, quickSource: s.quickSource === 'user' ? 'user' : 'rule' };
  });
}

export function toggleStepQuick(steps: StepDraft[], key: string): StepDraft[] {
  return steps.map((s) => (s.key === key ? { ...s, quick: !s.quick, quickSource: 'user' } : s));
}

/** Replaces one step with several (AI "shrink it" / "I'm stuck"). */
export function replaceStep(steps: StepDraft[], key: string, parts: StepDraft[]): StepDraft[] {
  const i = steps.findIndex((s) => s.key === key);
  if (i < 0) return steps;
  return [...steps.slice(0, i), ...parts, ...steps.slice(i + 1)];
}

/** Steps with a title, in order. Blank rows are dropped when saving. */
export function filledSteps(steps: StepDraft[]): StepDraft[] {
  return steps.filter((s) => s.title.trim().length > 0);
}

/** Sum of the step guesses, or null when no step has one. */
export function sumStepGuesses(steps: StepDraft[]): number | null {
  let total = 0;
  let any = false;
  for (const s of steps) {
    const m = parseMinutes(s.guess);
    if (m !== null) {
      total += m;
      any = true;
    }
  }
  return any ? total : null;
}

/** The first open step's guess, for the first-step rule hint. */
export function firstStepGuess(steps: StepDraft[]): { key: string; minutes: number } | null {
  const first = filledSteps(steps).find((s) => !s.done);
  if (!first) return null;
  const minutes = parseMinutes(first.guess);
  return minutes === null ? null : { key: first.key, minutes };
}

/* ------------------------------------------------------------ recurrence */

export function recurrenceFromRule(rule: RecurrenceRule | null | undefined): RecurrenceDraft {
  if (!rule || !rule.active) return { kind: 'none', weekdays: [], interval: '2' };
  return {
    kind: rule.kind,
    weekdays: rule.weekdays.slice(),
    interval: String(Math.max(2, rule.interval)),
  };
}

/** A recurrence the form can save: weekdays need at least one day, every N days needs N >= 2. */
export function isRecurrenceComplete(r: RecurrenceDraft): boolean {
  if (r.kind === 'weekdays') return r.weekdays.length > 0;
  if (r.kind === 'every_n_days') {
    const n = parseMinutes(r.interval);
    return n !== null && n >= 2 && n <= 365;
  }
  return true;
}

export function recurrenceInterval(r: RecurrenceDraft): number {
  if (r.kind !== 'every_n_days') return 1;
  const n = parseMinutes(r.interval);
  return n !== null && n >= 2 ? Math.min(n, 365) : 2;
}
