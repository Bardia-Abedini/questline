/**
 * Search and filters for the quest log (plan section 1). Pure functions.
 */
import type { Difficulty, Priority } from '@/domain/types';
import type { Quest, Tag, Uuid } from '@/data/types';

export interface QuestFilters {
  search: string;
  categoryIds: Uuid[];
  tagIds: Uuid[];
  priorities: Priority[];
  difficulties: Difficulty[];
}

export const NO_FILTERS: QuestFilters = {
  search: '',
  categoryIds: [],
  tagIds: [],
  priorities: [],
  difficulties: [],
};

/** Number of filter choices in use (search not included). */
export function activeFilterCount(f: QuestFilters): number {
  return f.categoryIds.length + f.tagIds.length + f.priorities.length + f.difficulties.length;
}

/**
 * Lowercase, trims, folds Arabic letter forms to Persian ones (ي -> ی, ك -> ک), removes
 * zero-width non-joiners and diacritics, so Persian search finds what the player typed.
 */
export function normalizeForSearch(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[ً-ٰٟ̀-ͯ]/g, '')
    .replace(/‌/g, ' ')
    .replace(/ي/g, 'ی')
    .replace(/ى/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ه')
    .replace(/[أإآ]/g, 'ا')
    .toLocaleLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Each search word must appear in the title, notes or a tag name. */
export function matchesSearch(
  quest: Pick<Quest, 'title' | 'notes' | 'tag_ids'>,
  search: string,
  tagsById: ReadonlyMap<Uuid, Pick<Tag, 'name'>>,
): boolean {
  const words = normalizeForSearch(search).split(' ').filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalizeForSearch(
    [quest.title, quest.notes, ...quest.tag_ids.map((id) => tagsById.get(id)?.name ?? '')].join(
      ' ',
    ),
  );
  return words.every((w) => haystack.includes(w));
}

/** OR inside a group, AND across groups. */
export function matchesFilters(
  quest: Pick<Quest, 'title' | 'notes' | 'tag_ids' | 'category_id' | 'priority' | 'difficulty'>,
  f: QuestFilters,
  tagsById: ReadonlyMap<Uuid, Pick<Tag, 'name'>>,
): boolean {
  if (f.categoryIds.length && !(quest.category_id && f.categoryIds.includes(quest.category_id)))
    return false;
  if (f.tagIds.length && !quest.tag_ids.some((id) => f.tagIds.includes(id))) return false;
  if (f.priorities.length && !f.priorities.includes(quest.priority)) return false;
  if (f.difficulties.length && !f.difficulties.includes(quest.difficulty)) return false;
  return matchesSearch(quest, f.search, tagsById);
}

export function filterQuests<
  Q extends Pick<Quest, 'title' | 'notes' | 'tag_ids' | 'category_id' | 'priority' | 'difficulty'>,
>(quests: readonly Q[], f: QuestFilters, tags: readonly Tag[]): Q[] {
  const tagsById = new Map(tags.map((t) => [t.id, t]));
  return quests.filter((q) => matchesFilters(q, f, tagsById));
}

export function toggleIn<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}
