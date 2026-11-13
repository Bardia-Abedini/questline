import { useTranslation } from 'react-i18next';
import { addDays, localDateTimeToMs } from '@/domain/dates';
import { isOverdue } from '@/domain/quests';
import { useNow, useToday, type Category, type Quest } from '@/data';
import { useFormat } from '@/i18n/useFormat';

/** A category's display name: built-ins are translated until the player renames them. */
export function useCategoryName() {
  const { t } = useTranslation('quests');
  return (c: Pick<Category, 'name' | 'name_key'> | undefined | null): string => {
    if (!c) return '';
    if (c.name.trim()) return c.name;
    if (c.name_key === 'school' || c.name_key === 'home' || c.name_key === 'personal')
      return t(`categories.defaults.${c.name_key}`);
    return t('categories.untitled');
  };
}

/** "Today 14:30", "Tomorrow", "12 Mar"... and a calm "was due" once it has passed. */
export function useDueText() {
  const { t } = useTranslation('quests');
  const format = useFormat();
  const today = useToday();
  const now = useNow();
  return (q: Pick<Quest, 'due_date' | 'due_time' | 'status' | 'overdue_asked_at'>) => {
    if (!q.due_date) return null;
    const day =
      q.due_date === today
        ? t('due.today')
        : q.due_date === addDays(today, 1)
          ? t('due.tomorrow')
          : format.date(q.due_date, 'dayMonth');
    const when = q.due_time
      ? t('due.at_time', { day, time: format.time(localDateTimeToMs(q.due_date, q.due_time)) })
      : day;
    const passed = isOverdue({ ...q }, now);
    return { text: passed ? t('due.was', { when }) : t('due.on', { when }), passed };
  };
}
