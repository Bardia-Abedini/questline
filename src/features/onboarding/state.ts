/**
 * Onboarding progress (plan section 14): four short screens for a first-time player.
 * The finished/skipped fact is `profile.onboarded_at` (synced, so another device never asks
 * again). Where the player is in the flow is device-local, so closing the app midway
 * resumes on the same screen.
 */
import {
  clock,
  createQuest,
  db,
  getProfile,
  getSettings,
  listQuestsByStatus,
  localMeta,
  updateProfile,
  writeTransaction,
} from '@/data';
import { canActivateAnother } from '@/domain/quests';
import { events } from '@/services';

export const WELCOME_PATH = '/welcome';
export const STEPS = ['welcome', 'adventurer', 'quest', 'session'] as const;
export type OnboardingStep = (typeof STEPS)[number];

/** Test and tooling bypass: with this localStorage flag the gate never redirects. */
export const SKIP_FLAG = 'ql.onboarding.skip';
const PROGRESS_KEY = 'onboarding_progress';

export interface OnboardingProgress {
  step: number;
  questId: string | null;
  stepId: string | null;
}

export const START: OnboardingProgress = { step: 0, questId: null, stepId: null };

export async function readProgress(): Promise<OnboardingProgress> {
  const saved = await localMeta.get<OnboardingProgress>(PROGRESS_KEY);
  if (!saved || typeof saved.step !== 'number') return START;
  return { ...START, ...saved, step: Math.min(STEPS.length - 1, Math.max(0, saved.step)) };
}

export async function saveProgress(p: OnboardingProgress): Promise<void> {
  await localMeta.set(PROGRESS_KEY, p);
}

export function skipFlagSet(): boolean {
  try {
    return localStorage.getItem(SKIP_FLAG) === '1';
  } catch {
    return false;
  }
}

/** Done or skipped: never shown again (unless replayed from Settings). */
export async function finishOnboarding(): Promise<void> {
  await localMeta.remove(PROGRESS_KEY);
  const profile = await getProfile();
  if (!profile.onboarded_at) await updateProfile({ onboarded_at: clock.iso() });
}

/**
 * A player who already has quests or rewards (an older install, or data that arrived by
 * sync) is not new: mark onboarding as done instead of showing it.
 */
export async function hasExistingData(): Promise<boolean> {
  const [quests, ledger] = await Promise.all([db.quests.count(), db.ledger_events.count()]);
  return quests > 0 || ledger > 0;
}

/**
 * The first quest. It goes straight to Active (so the first session can start) unless
 * Active is already full, in which case it waits in the backlog.
 */
export async function createFirstQuest(title: string) {
  const [active, settings] = await Promise.all([listQuestsByStatus('active'), getSettings()]);
  const status = canActivateAnother(active.length, settings.active_limit) ? 'active' : 'backlog';
  return writeTransaction(['quests', 'steps'], async () => {
    const now = clock.iso();
    const created = await createQuest({
      title: title.trim(),
      status,
      source: 'onboarding',
      activated_at: status === 'active' ? now : null,
      last_touched_at: now,
      difficulty: 'E',
      guess_minutes: 5,
    });
    events.emitAfterCommit('quest.created', { questId: created.quest.id, source: 'onboarding' });
    if (status === 'active')
      events.emitAfterCommit('quest.activated', { questId: created.quest.id });
    return created;
  });
}
