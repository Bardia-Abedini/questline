import { describe, expect, it } from 'vitest';
import {
  estimateRatios,
  ratioFor,
  roundGuessMinutes,
  suggestAdjustedGuess,
  type EstimateSample,
} from './estimates';

const s = (guess: number, actual: number, categoryId: string | null = null): EstimateSample => ({
  guessMinutes: guess,
  actualMinutes: actual,
  categoryId,
});

describe('estimateRatios', () => {
  it('needs at least three samples', () => {
    expect(estimateRatios([s(10, 20), s(10, 20)]).overall).toBeNull();
    expect(estimateRatios([s(10, 20), s(10, 20), s(10, 20)]).overall).toEqual({
      ratio: 2,
      samples: 3,
    });
  });

  it('uses the median, so one wild quest does not dominate', () => {
    const r = estimateRatios([s(10, 18), s(10, 20), s(10, 15), s(10, 600)]);
    expect(r.overall!.ratio).toBe(1.9);
  });

  it('clamps single ratios into [0.2, 5]', () => {
    const r = estimateRatios([s(1, 100), s(1, 100), s(1, 100)]);
    expect(r.overall!.ratio).toBe(5);
    const low = estimateRatios([s(100, 1), s(100, 1), s(100, 1)]);
    expect(low.overall!.ratio).toBe(0.2);
  });

  it('skips unusable samples', () => {
    const r = estimateRatios([
      s(0, 10),
      s(10, 0),
      s(-1, 5),
      s(Number.NaN, 5),
      s(10, 10),
      s(10, 10),
    ]);
    expect(r.overall).toBeNull();
  });

  it('groups per category, only with enough samples', () => {
    const r = estimateRatios([
      s(10, 30, 'school'),
      s(10, 30, 'school'),
      s(10, 30, 'school'),
      s(10, 10, 'home'),
      s(10, 10, 'home'),
      s(10, 10, null),
    ]);
    expect(r.byCategory).toEqual({ school: { ratio: 3, samples: 3 } });
    expect(r.overall).toEqual({ ratio: 2, samples: 6 });
  });

  it('accepts a custom minimum', () => {
    expect(estimateRatios([s(10, 15)], 1).overall).toEqual({ ratio: 1.5, samples: 1 });
  });
});

describe('ratioFor', () => {
  const ratios = estimateRatios([
    s(10, 30, 'school'),
    s(10, 30, 'school'),
    s(10, 30, 'school'),
    s(10, 10, 'home'),
  ]);
  it('prefers the category ratio, falls back to overall', () => {
    expect(ratioFor(ratios, 'school')!.ratio).toBe(3);
    expect(ratioFor(ratios, 'home')).toEqual(ratios.overall);
    expect(ratioFor(ratios, null)).toEqual(ratios.overall);
  });
  it('is null with no data at all', () => {
    expect(ratioFor(estimateRatios([]), 'x')).toBeNull();
  });
});

describe('roundGuessMinutes', () => {
  it.each([
    [0.3, 1],
    [1, 1],
    [7.4, 7],
    [14.6, 15],
    [17, 15],
    [18, 20],
    [44, 45],
    [59, 60],
    [65, 60],
    [68, 75],
    [130, 135],
  ])('%d -> %d', (input, out) => {
    expect(roundGuessMinutes(input)).toBe(out);
  });
});

describe('suggestAdjustedGuess', () => {
  it('suggests a bigger guess for someone who usually takes longer', () => {
    expect(suggestAdjustedGuess(25, { ratio: 1.8, samples: 5 })).toEqual({
      ratio: 1.8,
      suggestedMinutes: 45,
    });
  });
  it('suggests a smaller guess for someone who overestimates', () => {
    expect(suggestAdjustedGuess(60, { ratio: 0.5, samples: 5 })).toEqual({
      ratio: 0.5,
      suggestedMinutes: 30,
    });
  });
  it('stays quiet near 1x, without data, or for invalid guesses', () => {
    expect(suggestAdjustedGuess(30, { ratio: 1.1, samples: 5 })).toBeNull();
    expect(suggestAdjustedGuess(30, null)).toBeNull();
    expect(suggestAdjustedGuess(0, { ratio: 2, samples: 5 })).toBeNull();
    expect(suggestAdjustedGuess(Number.NaN, { ratio: 2, samples: 5 })).toBeNull();
  });
  it('stays quiet when rounding leaves the guess unchanged', () => {
    expect(suggestAdjustedGuess(1, { ratio: 0.5, samples: 5 })).toBeNull();
  });
  it('rounds the displayed ratio to one decimal', () => {
    expect(suggestAdjustedGuess(20, { ratio: 1.8333, samples: 5 })!.ratio).toBe(1.8);
  });
});
