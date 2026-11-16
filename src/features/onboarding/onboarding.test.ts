import { beforeEach, describe, expect, it } from 'vitest';
import { createQuest, db, ensureLocalData, getProfile, updateSettings } from '@/data';
import { events } from '@/services';
import { resetAll } from '@/test/db';
import {
  createFirstQuest,
  finishOnboarding,
  hasExistingData,
  readProgress,
  saveProgress,
  START,
} from './state';

describe('onboarding state', () => {
  beforeEach(async () => {
    await resetAll();
    await ensureLocalData();
  });

  it('resumes where the player left off', async () => {
    expect(await readProgress()).toEqual(START);
    await saveProgress({ step: 2, questId: null, stepId: null });
    expect((await readProgress()).step).toBe(2);
    await saveProgress({ step: 99, questId: null, stepId: null });
    expect((await readProgress()).step).toBe(3);
  });

  it('finishing marks the profile once and forgets the progress', async () => {
    await saveProgress({ step: 1, questId: null, stepId: null });
    await finishOnboarding();
    const first = (await getProfile()).onboarded_at;
    expect(first).not.toBeNull();
    expect(await readProgress()).toEqual(START);
    await finishOnboarding();
    expect((await getProfile()).onboarded_at).toBe(first);
  });

  it('the first quest goes to Active with one step, and says so', async () => {
    const seen: string[] = [];
    events.on('quest.created', () => seen.push('created'));
    events.on('quest.activated', () => seen.push('activated'));
    const { quest, steps } = await createFirstQuest('  Tidy my desk ');
    expect(quest).toMatchObject({ title: 'Tidy my desk', status: 'active', source: 'onboarding' });
    expect(steps).toHaveLength(1);
    expect(seen).toEqual(['created', 'activated']);
  });

  it('waits in the backlog when Active is already full', async () => {
    await updateSettings({ active_limit: 1 });
    await createQuest({ title: 'Already busy', status: 'active' });
    const { quest } = await createFirstQuest('New one');
    expect(quest.status).toBe('backlog');
  });

  it('knows a player with existing data is not new', async () => {
    expect(await hasExistingData()).toBe(false);
    await createQuest({ title: 'x' });
    expect(await hasExistingData()).toBe(true);
    expect(await db.quests.count()).toBe(1);
  });
});
