import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { isLanguage, type Language } from './config';
import {
  formatCompact,
  formatDate,
  formatDuration,
  formatNumber,
  formatPercent,
  formatRelativeDays,
  formatTime,
  formatTimer,
  localizeDigits,
  type DateInput,
  type DateStyle,
} from './format';

/** Formatters bound to the current language. Re-renders when the language changes. */
export function useFormat() {
  const { i18n } = useTranslation();
  const lang: Language = isLanguage(i18n.language) ? i18n.language : 'en';
  return useMemo(
    () => ({
      lang,
      number: (n: number, o?: Intl.NumberFormatOptions) => formatNumber(n, lang, o),
      compact: (n: number) => formatCompact(n, lang),
      percent: (r: number) => formatPercent(r, lang),
      date: (d: DateInput, style?: DateStyle) => formatDate(d, lang, style),
      time: (d: Date | number) => formatTime(d, lang),
      relativeDays: (days: number) => formatRelativeDays(days, lang),
      timer: (ms: number) => formatTimer(ms, lang),
      duration: (ms: number) => formatDuration(ms, lang),
      digits: (text: string) => localizeDigits(text, lang),
    }),
    [lang],
  );
}
