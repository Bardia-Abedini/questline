/**
 * Estimate trainer (plan section 8): the personal ratio of actual time to guessed time,
 * overall and per category, and a suggested adjusted guess when adding a quest.
 */

export interface EstimateSample {
  guessMinutes: number;
  actualMinutes: number;
  categoryId?: string | null;
}

export interface RatioStat {
  /** Typical actual / guess, as a median of the per-quest ratios. */
  ratio: number;
  samples: number;
}

export interface EstimateRatios {
  overall: RatioStat | null;
  byCategory: Record<string, RatioStat>;
}

/** Fewer samples than this give no ratio. */
export const MIN_ESTIMATE_SAMPLES = 3;
/** Single ratios are clamped into this range so one wild quest cannot dominate. */
export const RATIO_CLAMP: readonly [number, number] = [0.2, 5];
/** No suggestion is offered when the ratio is within this distance of 1. */
export const SUGGESTION_THRESHOLD = 0.2;

function isUsable(s: EstimateSample): boolean {
  return (
    Number.isFinite(s.guessMinutes) &&
    Number.isFinite(s.actualMinutes) &&
    s.guessMinutes > 0 &&
    s.actualMinutes > 0
  );
}

function median(values: number[]): number {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function stat(samples: EstimateSample[], minSamples: number): RatioStat | null {
  if (samples.length < minSamples) return null;
  const [lo, hi] = RATIO_CLAMP;
  const ratios = samples.map((s) => Math.min(hi, Math.max(lo, s.actualMinutes / s.guessMinutes)));
  return { ratio: median(ratios), samples: samples.length };
}

export function estimateRatios(
  samples: readonly EstimateSample[],
  minSamples = MIN_ESTIMATE_SAMPLES,
): EstimateRatios {
  const usable = samples.filter(isUsable);
  const groups = new Map<string, EstimateSample[]>();
  for (const s of usable) {
    if (!s.categoryId) continue;
    const list = groups.get(s.categoryId) ?? [];
    list.push(s);
    groups.set(s.categoryId, list);
  }
  const byCategory: Record<string, RatioStat> = {};
  for (const [id, list] of groups) {
    const st = stat(list, minSamples);
    if (st) byCategory[id] = st;
  }
  return { overall: stat(usable, minSamples), byCategory };
}

/** The ratio to use for a new quest: its category's when known, else the overall one. */
export function ratioFor(ratios: EstimateRatios, categoryId?: string | null): RatioStat | null {
  return (categoryId && ratios.byCategory[categoryId]) || ratios.overall;
}

/** Rounds minutes to friendly values: whole minutes under 15, then 5s, then 15s from 60 up. */
export function roundGuessMinutes(minutes: number): number {
  if (minutes <= 1) return 1;
  if (minutes < 15) return Math.round(minutes);
  if (minutes < 60) return Math.round(minutes / 5) * 5;
  return Math.round(minutes / 15) * 15;
}

export interface GuessSuggestion {
  /** The ratio rounded to one decimal, for display ("about 1.8x"). */
  ratio: number;
  suggestedMinutes: number;
}

/**
 * "You usually take about 1.8x; use 45 min instead?" Returns null when there is no ratio
 * yet, the ratio is close to 1, or rounding leaves the guess unchanged.
 */
export function suggestAdjustedGuess(
  guessMinutes: number,
  ratio: RatioStat | null,
): GuessSuggestion | null {
  if (!ratio || !Number.isFinite(guessMinutes) || guessMinutes <= 0) return null;
  if (Math.abs(ratio.ratio - 1) < SUGGESTION_THRESHOLD) return null;
  const suggestedMinutes = roundGuessMinutes(guessMinutes * ratio.ratio);
  if (suggestedMinutes === roundGuessMinutes(guessMinutes)) return null;
  return { ratio: Math.round(ratio.ratio * 10) / 10, suggestedMinutes };
}
