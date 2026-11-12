/** Whether an element is laid out right to left (nearest `dir` attribute, then computed style). */
export function isRtl(el: Element): boolean {
  const dir = el.closest('[dir]')?.getAttribute('dir');
  if (dir === 'rtl' || dir === 'ltr') return dir === 'rtl';
  return getComputedStyle(el).direction === 'rtl';
}
