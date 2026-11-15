import { isMilestoneLevel } from '@/domain/levels';

/** Titles shown next to the player's name, unlocked at milestone levels. */
export interface TitleDef {
  id: string;
  /** i18n key in the `game` namespace. */
  nameKey: string;
  level: number;
}

export const TITLES: readonly TitleDef[] = Object.freeze(
  (
    [
      ['title_newcomer', 1],
      ['title_steady_stepper', 5],
      ['title_quest_keeper', 10],
      ['title_lantern_bearer', 15],
      ['title_trailblazer', 20],
      ['title_cottage_sage', 25],
      ['title_legend', 30],
    ] as const
  ).map(([id, level]) => ({ id, level, nameKey: `titles.${id}` })),
);

export const DEFAULT_TITLE = 'title_newcomer';
/** Stored in `profile.title_id` when the player chose to show no title (null = default). */
export const NO_TITLE = 'none';

export function titleById(id: string | null | undefined): TitleDef | undefined {
  return TITLES.find((t) => t.id === id);
}

export function titlesUnlockedAt(level: number): TitleDef[] {
  return TITLES.filter((t) => t.level === level && (level === 1 || isMilestoneLevel(level)));
}

export function availableTitles(level: number): TitleDef[] {
  return TITLES.filter((t) => t.level <= level);
}
