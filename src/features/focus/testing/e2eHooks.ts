/**
 * Test-only helpers for e2e/focus.spec.ts. Loaded only when localStorage['ql.focus.e2e']
 * is '1' (set by the spec before the page loads). The Quests screens live in another
 * package, so the spec seeds quests and steps through the repositories here.
 */
import {
  createQuest,
  db,
  getSettings,
  updateProfile,
  updateSettings,
  type Difficulty,
  type Settings,
} from '@/data';

export interface SeedQuest {
  title: string;
  difficulty?: Difficulty;
  guessMinutes?: number | null;
  steps: Array<{ title: string; guessMinutes?: number | null }>;
}

const hooks = {
  async seedQuest(input: SeedQuest) {
    const { quest, steps } = await createQuest({
      title: input.title,
      status: 'active',
      difficulty: input.difficulty ?? 'C',
      guess_minutes: input.guessMinutes ?? null,
      steps: input.steps.map((s) => ({ title: s.title, guess_minutes: s.guessMinutes ?? null })),
    });
    return { questId: quest.id, stepIds: steps.map((s) => s.id) };
  },
  async markOnboarded() {
    await updateProfile({ onboarded_at: new Date().toISOString() });
  },
  async setSettings(patch: Partial<Settings>) {
    await updateSettings(patch);
  },
  getSettings,
  sessions: () => db.focus_sessions.orderBy('started_at').toArray(),
  step: (id: string) => db.steps.get(id),
  quest: (id: string) => db.quests.get(id),
  inbox: async () =>
    (await db.quests.where('status').equals('inbox').toArray()).filter((q) => !q.deleted_at),
  notes: () => db.distraction_notes.toArray(),
  ledger: () => db.ledger_events.toArray(),
};

export type FocusTestHooks = typeof hooks;

export function install(): void {
  (window as unknown as { __qlFocus: FocusTestHooks }).__qlFocus = hooks;
}
