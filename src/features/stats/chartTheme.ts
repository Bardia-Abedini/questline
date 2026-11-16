import { useMemo } from 'react';
import { usePreferences } from '@/app/preferences/preferences';

export type ChartTone = 'primary' | 'accent' | 'xp' | 'info';

const TOKEN: Record<ChartTone | 'grid' | 'axis' | 'surface', string> = {
  primary: '--ql-primary',
  accent: '--ql-accent',
  xp: '--ql-xp',
  info: '--ql-info',
  grid: '--ql-border',
  axis: '--ql-text-muted',
  surface: '--ql-surface',
};

/** Theme colors as real values (SVG attributes cannot use CSS variables everywhere). */
export function useChartColors(): Record<keyof typeof TOKEN, string> {
  const theme = usePreferences((s) => s.resolved.theme);
  return useMemo(() => {
    const style = getComputedStyle(document.documentElement);
    const out = {} as Record<keyof typeof TOKEN, string>;
    for (const [k, v] of Object.entries(TOKEN)) {
      out[k as keyof typeof TOKEN] = style.getPropertyValue(v).trim() || 'currentColor';
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);
}

export function useRtl(): boolean {
  return usePreferences((s) => s.language) === 'fa';
}
