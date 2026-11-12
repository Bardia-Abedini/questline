import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { focusPath } from '@/app/routing';
import { DIFFICULTIES, PRIORITIES } from '@/domain/types';
import { useCategories, useTags, type Category, type QuestStatus, type Uuid } from '@/data';
import { useFormat } from '@/i18n/useFormat';
import {
  Button,
  buttonClass,
  EmptyState,
  IconButton,
  Input,
  Page,
  showToast,
  Tabs,
  ToggleChip,
  type IconName,
} from '@/ui';
import { useCategoryMap, useQuestList, useStatusCounts, type QuestWithSteps } from '../hooks';
import { deleteQuest, moveInboxToBacklog, restoreQuest, undoDeleteQuest } from '../model/actions';
import {
  activeFilterCount,
  filterQuests,
  NO_FILTERS,
  toggleIn,
  type QuestFilters,
} from '../model/filters';
import { questGuessMinutes, questActualMs } from '../model/estimates';
import { QuestCard } from '../components/QuestCard';
import { stepProgress } from '../components/questUtils';
import { useCategoryName } from '../components/labels';
import { QuestIcon } from '../components/QuestIcon';
import { useStartQuest } from '../components/useStartQuest';

type Tab = 'backlog' | 'inbox' | 'done' | 'archived';
const TABS: readonly Tab[] = ['backlog', 'inbox', 'done', 'archived'];
const TAB_ICONS: Record<Tab, IconName> = {
  backlog: 'quests',
  inbox: 'inbox',
  done: 'check',
  archived: 'archive',
};

function isTab(v: string | null): v is Tab {
  return !!v && (TABS as readonly string[]).includes(v);
}

/** Backlog / Inbox / Done / Archive with search and filters (plan sections 1 and 2). */
export function QuestsPage() {
  const { t } = useTranslation('quests');
  const { number } = useFormat();
  const [params, setParams] = useSearchParams();
  const tab: Tab = isTab(params.get('tab')) ? (params.get('tab') as Tab) : 'backlog';
  const counts = useStatusCounts();
  const [filters, setFilters] = useState<QuestFilters>(NO_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const { start, sheet } = useStartQuest();
  const filterPanelId = useId();
  const filterCount = activeFilterCount(filters);

  const setTab = (next: Tab) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        if (next === 'backlog') n.delete('tab');
        else n.set('tab', next);
        return n;
      },
      { replace: true },
    );

  const badge = (status: QuestStatus) =>
    counts && counts[status] > 0 ? number(counts[status]) : undefined;

  const panel = (status: Tab) => (
    <QuestTabPanel status={status} filters={filters} onStart={(q) => start(q)} />
  );

  return (
    <Page
      title={t('title')}
      subtitle={t('subtitle')}
      actions={
        <Link to="/quests/new" className={buttonClass('primary')}>
          <QuestIcon name="plus" />
          {t('actions.new_quest')}
        </Link>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-end gap-2">
          <Input
            type="search"
            label={t('search.label')}
            hideLabel
            placeholder={t('search.placeholder')}
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            wrapperClassName="min-w-0 flex-1"
            enterKeyHint="search"
          />
          <Button
            variant={filterCount ? 'soft' : 'secondary'}
            aria-expanded={showFilters}
            aria-controls={filterPanelId}
            onClick={() => setShowFilters((v) => !v)}
            className="shrink-0"
          >
            <QuestIcon name="filter" />
            <span>{t('filters.button')}</span>
            {filterCount > 0 && (
              <span className="rounded-full bg-surface px-1.5 text-xs leading-5">
                <span className="ql-visually-hidden">{t('filters.in_use')}</span>
                {number(filterCount)}
              </span>
            )}
          </Button>
        </div>
        <div id={filterPanelId} hidden={!showFilters}>
          {showFilters && <FilterPanel filters={filters} onChange={setFilters} />}
        </div>
        <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label={t('manage.label')}>
          <Link to="/quests/templates" className="font-bold text-primary hover:underline">
            {t('templates.title')}
          </Link>
          <Link to="/quests/categories" className="font-bold text-primary hover:underline">
            {t('categories.title')}
          </Link>
        </nav>
      </div>

      <Tabs
        label={t('tabs.label')}
        value={tab}
        onChange={setTab}
        items={TABS.map((value) => ({
          value,
          label: t(`tabs.${value}`),
          icon: TAB_ICONS[value],
          badge: badge(value),
          content: panel(value),
        }))}
      />
      {sheet}
    </Page>
  );
}

function FilterPanel({
  filters,
  onChange,
}: {
  filters: QuestFilters;
  onChange: (f: QuestFilters) => void;
}) {
  const { t } = useTranslation('quests');
  const categories = useCategories();
  const tags = useTags();
  const categoryName = useCategoryName();
  const group = (title: string, children: React.ReactNode) => (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-1 text-sm font-bold text-text">{title}</legend>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </fieldset>
  );
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
      {group(
        t('form.category'),
        (categories ?? []).map((c: Category) => (
          <ToggleChip
            key={c.id}
            dotColor={c.color}
            selected={filters.categoryIds.includes(c.id)}
            onChange={() =>
              onChange({ ...filters, categoryIds: toggleIn(filters.categoryIds, c.id) })
            }
          >
            {categoryName(c)}
          </ToggleChip>
        )),
      )}
      {tags &&
        tags.length > 0 &&
        group(
          t('form.tags'),
          tags.map((tag) => (
            <ToggleChip
              key={tag.id}
              selected={filters.tagIds.includes(tag.id)}
              onChange={() => onChange({ ...filters, tagIds: toggleIn(filters.tagIds, tag.id) })}
            >
              #{tag.name}
            </ToggleChip>
          )),
        )}
      {group(
        t('form.priority'),
        PRIORITIES.map((p) => (
          <ToggleChip
            key={p}
            selected={filters.priorities.includes(p)}
            onChange={() => onChange({ ...filters, priorities: toggleIn(filters.priorities, p) })}
          >
            {t(`priority.${p}`)}
          </ToggleChip>
        )),
      )}
      {group(
        t('form.difficulty'),
        DIFFICULTIES.map((d) => (
          <ToggleChip
            key={d}
            selected={filters.difficulties.includes(d)}
            aria-label={t('difficulty.rank', { rank: d })}
            onChange={() =>
              onChange({ ...filters, difficulties: toggleIn(filters.difficulties, d) })
            }
          >
            {d}
          </ToggleChip>
        )),
      )}
      {activeFilterCount(filters) > 0 && (
        <div>
          <Button
            variant="ghost"
            size="sm"
            icon="close"
            onClick={() => onChange({ ...NO_FILTERS, search: filters.search })}
          >
            {t('filters.clear')}
          </Button>
        </div>
      )}
    </div>
  );
}

function useFiltered(list: QuestWithSteps[] | undefined, filters: QuestFilters) {
  const tags = useTags();
  return useMemo(() => {
    if (!list) return undefined;
    const quests = filterQuests(
      list.map((x) => x.quest),
      filters,
      tags ?? [],
    );
    const keep = new Set(quests.map((q) => q.id));
    return list.filter((x) => keep.has(x.quest.id));
  }, [list, filters, tags]);
}

function QuestTabPanel({
  status,
  filters,
  onStart,
}: {
  status: Tab;
  filters: QuestFilters;
  onStart: (q: { id: Uuid; title: string }) => void;
}) {
  const { t } = useTranslation('quests');
  const format = useFormat();
  const navigate = useNavigate();
  const categories = useCategoryMap();
  const main = useFiltered(useQuestList(status), filters);
  const activeRaw = useQuestList('active');
  const active = useFiltered(status === 'backlog' ? activeRaw : [], filters);
  const filtering = filters.search.trim() !== '' || activeFilterCount(filters) > 0;

  if (!main) return null;

  const onDelete = async (item: QuestWithSteps) => {
    await deleteQuest(item.quest.id);
    showToast({
      title: t('toast.deleted', { title: item.quest.title }),
      icon: 'trash',
      action: { label: t('actions.undo'), onClick: () => void undoDeleteQuest(item.quest.id) },
    });
  };

  const actionsFor = (item: QuestWithSteps) => {
    const { quest, steps } = item;
    switch (quest.status) {
      case 'active': {
        const next = stepProgress(steps).next;
        return (
          <IconButton
            icon="play"
            variant="soft"
            size="sm"
            label={t('actions.start_quest', { title: quest.title })}
            onClick={() => next && navigate(focusPath({ stepId: next.id }))}
          />
        );
      }
      case 'backlog':
        return (
          <IconButton
            icon="play"
            variant="soft"
            size="sm"
            label={t('actions.start_quest', { title: quest.title })}
            onClick={() => onStart(quest)}
          />
        );
      case 'inbox':
        return (
          <>
            <Link
              to={`/quests/${quest.id}/edit?sort=1`}
              className={buttonClass('soft', 'sm')}
              aria-label={t('inbox.sort_for', { title: quest.title })}
            >
              {t('inbox.sort')}
            </Link>
            <IconButton
              icon="quests"
              size="sm"
              label={t('inbox.to_backlog_for', { title: quest.title })}
              onClick={async () => {
                await moveInboxToBacklog(quest.id);
                showToast({ title: t('toast.to_backlog', { title: quest.title }), icon: 'quests' });
              }}
            />
            <IconButton
              icon="trash"
              size="sm"
              label={t('actions.delete_for', { title: quest.title })}
              onClick={() => onDelete(item)}
            />
          </>
        );
      case 'archived':
        return (
          <Button
            variant="secondary"
            size="sm"
            icon="refresh"
            aria-label={t('actions.restore_for', { title: quest.title })}
            onClick={() => restoreQuest(quest.id)}
          >
            {t('actions.restore')}
          </Button>
        );
      default:
        return null;
    }
  };

  const extraFor = (item: QuestWithSteps) => {
    if (item.quest.status !== 'done') return null;
    const guess = questGuessMinutes(item.quest, item.steps);
    const actual = questActualMs(item.steps);
    const parts: string[] = [];
    if (item.quest.completed_at)
      parts.push(
        t('done.finished_on', {
          date: format.date(Date.parse(item.quest.completed_at), 'dayMonth'),
        }),
      );
    const g = guess ? format.duration(guess * 60_000) : null;
    const a = actual > 0 ? format.duration(actual) : null;
    if (g && a) parts.push(t('estimate.guess_vs_actual', { guess: g, actual: a }));
    else if (a) parts.push(t('estimate.actual_only', { actual: a }));
    return parts.length ? <p className="text-sm text-muted">{parts.join(' · ')}</p> : null;
  };

  const list = (items: QuestWithSteps[]) => (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <QuestCard
          key={item.quest.id}
          item={item}
          categories={categories}
          actions={actionsFor(item)}
          extra={extraFor(item)}
        />
      ))}
    </ul>
  );

  const empty = filtering ? (
    <EmptyState icon="search" title={t('empty.filtered_title')}>
      {t('empty.filtered_body')}
    </EmptyState>
  ) : (
    <EmptyState
      icon={TAB_ICONS[status]}
      title={t(`empty.${status}_title`)}
      action={
        status === 'backlog' ? (
          <Link to="/quests/new" className={buttonClass('primary')}>
            {t('actions.new_quest')}
          </Link>
        ) : undefined
      }
    >
      {t(`empty.${status}_body`)}
    </EmptyState>
  );

  const hasActive = status === 'backlog' && active && active.length > 0;
  return (
    <div className="flex flex-col gap-5">
      {status === 'inbox' && main.length > 0 && (
        <p className="text-sm text-muted">{t('inbox.hint')}</p>
      )}
      {hasActive && (
        <section className="flex flex-col gap-2" aria-labelledby="active-now">
          <h2 id="active-now" className="text-lg font-semibold">
            {t('backlog.active_now')}
          </h2>
          {list(active)}
        </section>
      )}
      {hasActive ? (
        <section className="flex flex-col gap-2" aria-labelledby="waiting">
          <h2 id="waiting" className="text-lg font-semibold">
            {t('backlog.waiting')}
          </h2>
          {main.length ? list(main) : <p className="text-muted">{t('backlog.waiting_empty')}</p>}
        </section>
      ) : main.length ? (
        list(main)
      ) : (
        empty
      )}
    </div>
  );
}
