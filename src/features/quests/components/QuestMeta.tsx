import { useTranslation } from 'react-i18next';
import { addDays, localDateTimeToMs } from '@/domain/dates';
import { isOverdue } from '@/domain/quests';
import { useNow, useToday, type Category, type Quest, type Tag, type Uuid } from '@/data';
import { useFormat } from '@/i18n/useFormat';
import { Chip, cx } from '@/ui';
import { QuestIcon } from './QuestIcon';

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

interface QuestMetaProps {
  quest: Quest;
  categories: ReadonlyMap<Uuid, Category>;
  tags?: ReadonlyMap<Uuid, Tag>;
  /** Show tags too (detail page). */
  showTags?: boolean;
  className?: string;
}

/** Difficulty, priority, category, due date and repeat as small calm chips. Never red. */
export function QuestMeta({ quest, categories, tags, showTags, className }: QuestMetaProps) {
  const { t } = useTranslation('quests');
  const categoryName = useCategoryName();
  const dueText = useDueText();
  const category = quest.category_id ? categories.get(quest.category_id) : undefined;
  const due = dueText(quest);
  return (
    <div className={cx('flex min-w-0 flex-wrap items-center gap-1.5', className)}>
      {quest.is_boss && (
        <Chip size="sm" tone="accent" icon="sword">
          {t('boss.chip')}
        </Chip>
      )}
      <Chip size="sm" tone="xp" title={t('form.difficulty')}>
        {t('difficulty.rank', { rank: quest.difficulty })}
      </Chip>
      {quest.priority !== 'medium' && (
        <Chip size="sm" tone={quest.priority === 'high' ? 'primary' : 'neutral'}>
          {t(`priority.${quest.priority}`)}
        </Chip>
      )}
      {category && (
        <Chip size="sm" dotColor={category.color}>
          {categoryName(category)}
        </Chip>
      )}
      {due && (
        <span
          className={cx(
            'inline-flex items-center gap-1 text-xs font-bold',
            due.passed ? 'text-faint' : 'text-muted',
          )}
        >
          <QuestIcon name="calendar" size="1.1em" />
          {due.text}
        </span>
      )}
      {quest.recurrence_rule_id && (
        <span className="inline-flex items-center gap-1 text-xs font-bold text-muted">
          <QuestIcon name="repeat" size="1.1em" />
          <span className="ql-visually-hidden">{t('recurrence.repeats')}</span>
        </span>
      )}
      {showTags &&
        tags &&
        quest.tag_ids.map((id) => {
          const tag = tags.get(id);
          return tag ? (
            <Chip key={id} size="sm">
              #{tag.name}
            </Chip>
          ) : null;
        })}
    </div>
  );
}
