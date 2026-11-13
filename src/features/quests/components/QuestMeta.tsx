import { useTranslation } from 'react-i18next';
import type { Category, Quest, Tag, Uuid } from '@/data';
import { Chip, cx } from '@/ui';
import { QuestIcon } from './QuestIcon';
import { useCategoryName, useDueText } from './labels';

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
      {quest.source === 'distraction' && (
        <Chip size="sm" icon="timer" title={t('source.distraction_hint')}>
          {t('source.distraction')}
        </Chip>
      )}
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
