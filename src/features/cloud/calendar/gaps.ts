/** Free time in a day: the gaps between busy blocks inside a day window. Pure. */
export interface Span {
  start: number;
  end: number;
}

export function freeGaps(busy: readonly Span[], window: Span, minMinutes = 15): Span[] {
  const blocks = busy
    .map((b) => ({ start: Math.max(b.start, window.start), end: Math.min(b.end, window.end) }))
    .filter((b) => b.end > b.start)
    .sort((a, b) => a.start - b.start);
  const gaps: Span[] = [];
  let cursor = window.start;
  for (const b of blocks) {
    if (b.start > cursor) gaps.push({ start: cursor, end: b.start });
    cursor = Math.max(cursor, b.end);
  }
  if (cursor < window.end) gaps.push({ start: cursor, end: window.end });
  return gaps.filter((g) => g.end - g.start >= minMinutes * 60_000);
}
