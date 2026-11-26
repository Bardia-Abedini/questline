/**
 * Seeded random numbers. Domain functions never call Math.random(); they take an `Rng`,
 * so tests are repeatable and the service layer decides where randomness comes from.
 */

export interface Rng {
  /** A float in [0, 1). */
  next(): number;
}

/** Mulberry32: small, fast, good enough for game rolls. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return {
    next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** A 32-bit seed from any string (FNV-1a), e.g. `seedFromString(userId + day)`. */
export function seedFromString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** An Rng that returns the given values in a loop. For tests and previews. */
export function sequenceRng(values: readonly number[]): Rng {
  if (values.length === 0) throw new RangeError('sequenceRng needs at least one value');
  let i = 0;
  return {
    next() {
      const v = values[i % values.length]!;
      i++;
      return v;
    },
  };
}

/** True with probability `p` (0..1). */
export function chance(rng: Rng, p: number): boolean {
  if (p <= 0) return false;
  if (p >= 1) return true;
  return rng.next() < p;
}

/** A whole number in [min, max], both included. */
export function randomInt(rng: Rng, min: number, max: number): number {
  const lo = Math.ceil(Math.min(min, max));
  const hi = Math.floor(Math.max(min, max));
  return lo + Math.floor(rng.next() * (hi - lo + 1));
}

/** One element of a non-empty array. */
export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new RangeError('pick needs a non-empty array');
  return items[Math.floor(rng.next() * items.length)]!;
}

/** A shuffled copy (Fisher-Yates). */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
