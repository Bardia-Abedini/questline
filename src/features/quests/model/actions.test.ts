import { beforeEach, describe, expect, it } from 'vitest';
import { resetAll } from '@/test/db';
import {
  clock,
  createQuest,
  db,
  ensureLocalData,
  focusSessionsRepo,
  listSteps,
  questsRepo,
  setClock,
  tagsRepo,
  templatesRepo,
  updateSettings,
  type Quest,
} from '@/data';
import { events, type AppEvents } from '@/services';
import {
  activateQuest,
  answerOverdue,
  applyQuickClassification,
  archiveQuest,
  createCategory,
  createQuestFromDraft,
  deactivateQuest,
  deleteCategory,
  deleteQuest,
  deleteTag,
  dismissOverdue,
  draftFromQuest,
  draftFromTemplate,
  ensureTag,
  firstOpenStep,
  hadFocusSession,
  moveInboxToBacklog,
  quickCapture,
  restoreQuest,
  saveAsTemplate,
  splitStepInto,
  swapActive,
  turnIntoBoss,
  undoDeleteQuest,
  updateQuestFromDraft,
} from './actions';
import { emptyDraft, makeStep, type QuestDraft } from './draft';

const T0 = Date.parse('2026-03-10T09:00:00.000Z');

beforeEach(async () => {
  await resetAll();
  setClock(T0);
  await ensureLocalData();
});

function record<K extends keyof AppEvents>(name: K) {
  const seen: AppEvents[K][] = [];
  events.on(name, (p) => seen.push(p));
  return seen;
}

function draft(patch: Partial<QuestDraft> = {}): QuestDraft {
  return { ...emptyDraft(), title: 'Write essay', ...patch };
}

async function makeActive(title: string): Promise<Quest> {
  const { quest } = await createQuestFromDraft(draft({ title }), { activate: true });
  return quest;
}

describe('createQuestFromDraft', () => {
  it('saves a title-only quest with one step named after it', async () => {
    const created = record('quest.created');
    const { quest, activated } = await createQuestFromDraft(draft({ guess: '20' }));
    expect(activated).toBe(false);
    expect(quest.status).toBe('backlog');
    expect(quest.guess_minutes).toBe(20);
    const steps = await listSteps(quest.id);
    expect(steps.map((s) => s.title)).toEqual(['Write essay']);
    expect(steps[0]!.quick).toBe(false);
    expect(created).toEqual([{ questId: quest.id, source: 'manual' }]);
  });

  it('saves steps in order with parsed guesses and quick flags, dropping blank rows', async () => {
    const { quest } = await createQuestFromDraft(
      draft({
        steps: [
          makeStep('Open the doc', 2),
          makeStep('   '),
          makeStep('Outline', 15),
          { ...makeStep('Title', null), guess: '۳' },
        ],
      }),
    );
    const steps = await listSteps(quest.id);
    expect(steps.map((s) => [s.title, s.guess_minutes, s.quick])).toEqual([
      ['Open the doc', 2, true],
      ['Outline', 15, false],
      ['Title', 3, true],
    ]);
  });

  it('activates only when asked and there is room', async () => {
    const activated = record('quest.activated');
    await makeActive('A');
    await makeActive('B');
    await makeActive('C');
    const fourth = await createQuestFromDraft(draft({ title: 'D' }), { activate: true });
    expect(fourth.activated).toBe(false);
    expect(fourth.quest.status).toBe('backlog');
    expect(activated).toHaveLength(3);
  });

  it('respects the due date and time, and drops a time without a date', async () => {
    const { quest } = await createQuestFromDraft(
      draft({ dueDate: '2026-03-12', dueTime: '14:30' }),
    );
    expect([quest.due_date, quest.due_time]).toEqual(['2026-03-12', '14:30']);
    const other = await createQuestFromDraft(draft({ dueTime: '14:30' }));
    expect([other.quest.due_date, other.quest.due_time]).toEqual([null, null]);
  });
});

describe('updateQuestFromDraft', () => {
  it('edits, reorders, adds and removes steps while keeping done steps done', async () => {
    const { quest } = await createQuestFromDraft(
      draft({ steps: [makeStep('One', 2), makeStep('Two', 2), makeStep('Three', 2)] }),
    );
    const [one, two, three] = await listSteps(quest.id);
    await db.steps.update(one!.id, { done_at: clock.iso() });
    const d = (await draftFromQuest(quest.id))!;
    expect(d.steps[0]!.done).toBe(true);
    // Remove "Two", move "Three" first, rename "One", add "Four".
    d.steps = [
      { ...d.steps[2]! },
      { ...d.steps[0]!, title: 'One (renamed)' },
      makeStep('Four', 10),
    ];
    d.title = 'Write the essay';
    await updateQuestFromDraft(quest.id, d);
    const steps = await listSteps(quest.id);
    expect(steps.map((s) => s.title)).toEqual(['Three', 'One (renamed)', 'Four']);
    expect(steps[0]!.id).toBe(three!.id);
    expect(steps[1]!.done_at).not.toBeNull();
    expect(await db.steps.get(two!.id)).toMatchObject({ deleted_at: expect.any(String) });
    expect((await questsRepo.get(quest.id))!.title).toBe('Write the essay');
  });

  it('gives a quest left with no steps one step named after it', async () => {
    const { quest } = await createQuestFromDraft(draft({ steps: [makeStep('Only', 2)] }));
    const d = (await draftFromQuest(quest.id))!;
    d.steps = [];
    await updateQuestFromDraft(quest.id, d);
    expect((await listSteps(quest.id)).map((s) => s.title)).toEqual(['Write essay']);
  });

  it('treats the automatic step as no steps: adding steps replaces it, renaming keeps it', async () => {
    const { quest } = await createQuestFromDraft(draft());
    const [auto] = await listSteps(quest.id);
    const d = (await draftFromQuest(quest.id))!;
    expect(d.steps).toEqual([]);
    await updateQuestFromDraft(quest.id, { ...d, title: 'Write the essay' });
    const renamed = await listSteps(quest.id);
    expect(renamed.map((s) => [s.id, s.title])).toEqual([[auto!.id, 'Write the essay']]);
    const d2 = (await draftFromQuest(quest.id))!;
    await updateQuestFromDraft(quest.id, { ...d2, steps: [makeStep('Outline', 10)] });
    expect((await listSteps(quest.id)).map((s) => s.title)).toEqual(['Outline']);
  });

  it('sorting an inbox item moves it to the backlog and emits inbox.sorted', async () => {
    const sorted = record('inbox.sorted');
    const q = await quickCapture('  call the dentist ');
    expect(q).toMatchObject({
      status: 'inbox',
      source: 'quick_capture',
      title: 'call the dentist',
    });
    const d = (await draftFromQuest(q.id))!;
    await updateQuestFromDraft(q.id, { ...d, priority: 'high' }, { sortFromInbox: true });
    expect((await questsRepo.get(q.id))!).toMatchObject({ status: 'backlog', priority: 'high' });
    expect(sorted).toEqual([{ questId: q.id }]);
  });
});

describe('active limit and swap', () => {
  it('reports full at the limit and swaps one for another', async () => {
    const a = await makeActive('A');
    await makeActive('B');
    await makeActive('C');
    const { quest: d } = await createQuestFromDraft(draft({ title: 'D' }));
    expect(await activateQuest(d.id)).toBe('full');
    const deactivated = record('quest.deactivated');
    const activated = record('quest.activated');
    await swapActive(a.id, d.id);
    expect((await questsRepo.get(a.id))!.status).toBe('backlog');
    expect((await questsRepo.get(d.id))!.status).toBe('active');
    expect(deactivated).toEqual([{ questId: a.id }]);
    expect(activated).toEqual([{ questId: d.id }]);
  });

  it('follows the limit setting', async () => {
    await updateSettings({ active_limit: 1 });
    await makeActive('A');
    const { quest } = await createQuestFromDraft(draft({ title: 'B' }));
    expect(await activateQuest(quest.id)).toBe('full');
    await updateSettings({ active_limit: 2 });
    expect(await activateQuest(quest.id)).toBe('activated');
    expect(await activateQuest(quest.id)).toBe('already');
  });

  it('deactivates back to the backlog with progress kept', async () => {
    const a = await makeActive('A');
    const step = (await listSteps(a.id))[0]!;
    await db.steps.update(step.id, { done_at: clock.iso() });
    await deactivateQuest(a.id);
    expect((await questsRepo.get(a.id))!.status).toBe('backlog');
    expect((await listSteps(a.id))[0]!.done_at).not.toBeNull();
  });

  it('moves an inbox item to the backlog in one tap', async () => {
    const q = await quickCapture('idea');
    await moveInboxToBacklog(q.id);
    expect((await questsRepo.get(q.id))!.status).toBe('backlog');
  });
});

describe('archive, restore and delete', () => {
  it('archives and restores', async () => {
    const archived = record('quest.archived');
    const { quest } = await createQuestFromDraft(draft());
    await archiveQuest(quest.id);
    expect((await questsRepo.get(quest.id))!).toMatchObject({ status: 'archived' });
    expect(archived).toHaveLength(1);
    await restoreQuest(quest.id);
    expect((await questsRepo.get(quest.id))!).toMatchObject({
      status: 'backlog',
      archived_at: null,
    });
  });

  it('soft-deletes a quest with its steps and can undo', async () => {
    const { quest } = await createQuestFromDraft(draft({ steps: [makeStep('a'), makeStep('b')] }));
    await deleteQuest(quest.id);
    expect(await questsRepo.get(quest.id)).toBeUndefined();
    expect(await listSteps(quest.id)).toEqual([]);
    expect(await db.quests.get(quest.id)).toBeDefined();
    await undoDeleteQuest(quest.id);
    expect(await questsRepo.get(quest.id)).toBeDefined();
    expect((await listSteps(quest.id)).map((s) => s.title)).toEqual(['a', 'b']);
  });
});

describe('overdue', () => {
  it('Yes keeps the quest with an optional new date; No archives it', async () => {
    const answers = record('quest.overdue_answered');
    const { quest: a } = await createQuestFromDraft(draft({ dueDate: '2026-03-01' }));
    const { quest: b } = await createQuestFromDraft(draft({ dueDate: '2026-03-01' }));
    await answerOverdue(a.id, 'keep', '2026-03-20');
    await answerOverdue(b.id, 'archive');
    expect((await questsRepo.get(a.id))!).toMatchObject({
      status: 'backlog',
      due_date: '2026-03-20',
      overdue_answer: 'keep',
      overdue_asked_at: expect.any(String),
    });
    expect((await questsRepo.get(b.id))!).toMatchObject({
      status: 'archived',
      overdue_answer: 'archive',
    });
    expect(answers.map((x) => x.answer)).toEqual(['keep', 'archive']);
  });

  it('dismissing still marks it as asked', async () => {
    const { quest } = await createQuestFromDraft(draft({ dueDate: '2026-03-01' }));
    await dismissOverdue(quest.id);
    expect((await questsRepo.get(quest.id))!.overdue_asked_at).not.toBeNull();
  });
});

describe('boss', () => {
  it('turns an S-rank quest into a boss once', async () => {
    const boss = record('quest.became_boss');
    const { quest } = await createQuestFromDraft(draft({ difficulty: 'S' }));
    expect(await turnIntoBoss(quest.id)).toBe(true);
    expect(await turnIntoBoss(quest.id)).toBe(false);
    expect((await questsRepo.get(quest.id))!).toMatchObject({ is_boss: true });
    expect(boss).toHaveLength(1);
  });

  it('refuses a fresh low-rank quest', async () => {
    const { quest } = await createQuestFromDraft(draft({ difficulty: 'C' }));
    expect(await turnIntoBoss(quest.id)).toBe(false);
  });
});

describe('steps', () => {
  it('splits a step into smaller ones in the same place', async () => {
    const { quest } = await createQuestFromDraft(
      draft({ steps: [makeStep('A', 2), makeStep('Big', 30), makeStep('C', 2)] }),
    );
    const big = (await listSteps(quest.id))[1]!;
    await splitStepInto(big.id, [
      { title: 'Big 1', guessMinutes: 2, quick: true },
      { title: 'Big 2', guessMinutes: 10, quick: false },
    ]);
    expect((await listSteps(quest.id)).map((s) => s.title)).toEqual(['A', 'Big 1', 'Big 2', 'C']);
  });

  it('finds the first open step and whether a step had focus time', async () => {
    const { quest } = await createQuestFromDraft(draft({ steps: [makeStep('A'), makeStep('B')] }));
    const [a, b] = await listSteps(quest.id);
    await db.steps.update(a!.id, { done_at: clock.iso() });
    expect((await firstOpenStep(quest.id))!.id).toBe(b!.id);
    expect(await hadFocusSession(b!.id)).toBe(false);
    await focusSessionsRepo.create({
      kind: 'focus',
      quest_id: quest.id,
      step_id: b!.id,
      started_at: clock.iso(),
      planned_ms: 1,
      pauses: [],
      away: [],
      distractions: [],
      ended_at: null,
      end_reason: null,
      focused_ms: 0,
      away_ms: 0,
      paused_ms: 0,
      double_xp: false,
      device_id: 'x',
    });
    expect(await hadFocusSession(b!.id)).toBe(true);
  });

  it('applies AI quick flags only to rule-flagged open steps', async () => {
    const { quest } = await createQuestFromDraft(
      draft({
        steps: [
          makeStep('Rule', 20),
          { ...makeStep('Mine', 20), quick: true, quickSource: 'user' },
        ],
      }),
    );
    await applyQuickClassification(quest.id, async (steps) => steps.map(() => true));
    const steps = await listSteps(quest.id);
    expect(steps.map((s) => [s.quick, s.quick_source])).toEqual([
      [true, 'ai'],
      [true, 'user'],
    ]);
  });
});

describe('templates', () => {
  it('round-trips a quest through a template', async () => {
    const tag = await ensureTag('#school');
    const { quest } = await createQuestFromDraft(
      draft({
        priority: 'high',
        difficulty: 'B',
        tagIds: [tag.id],
        steps: [makeStep('Read', 10), makeStep('Write', 3)],
      }),
    );
    const template = await saveAsTemplate(quest.id);
    expect(template.steps).toEqual([
      { title: 'Read', guess_minutes: 10, quick: false },
      { title: 'Write', guess_minutes: 3, quick: true },
    ]);
    const d = draftFromTemplate((await templatesRepo.get(template.id))!, emptyDraft());
    const { quest: copy } = await createQuestFromDraft(d, {
      source: 'template',
      templateId: template.id,
    });
    expect(copy).toMatchObject({
      title: 'Write essay',
      priority: 'high',
      difficulty: 'B',
      tag_ids: [tag.id],
      source: 'template',
      template_id: template.id,
    });
    expect((await listSteps(copy.id)).map((s) => s.title)).toEqual(['Read', 'Write']);
  });
});

describe('categories and tags', () => {
  it('reuses tags by name and removes deleted tags from quests', async () => {
    const a = await ensureTag('Exam');
    const b = await ensureTag('exam');
    expect(b.id).toBe(a.id);
    const { quest } = await createQuestFromDraft(draft({ tagIds: [a.id] }));
    await deleteTag(a.id);
    expect((await questsRepo.get(quest.id))!.tag_ids).toEqual([]);
    expect(await tagsRepo.get(a.id)).toBeUndefined();
  });

  it('deleting a category leaves its quests without one', async () => {
    const cat = await createCategory({ name: ' Work ', color: 'teal', icon: 'sword' });
    expect(cat.name).toBe('Work');
    const { quest } = await createQuestFromDraft(draft({ categoryId: cat.id }));
    await deleteCategory(cat.id);
    expect((await questsRepo.get(quest.id))!.category_id).toBeNull();
  });
});

describe('createQuest from other packages still works', () => {
  it('distraction notes land in the inbox', async () => {
    const { quest } = await createQuest({ title: 'note', status: 'inbox', source: 'distraction' });
    expect(quest.status).toBe('inbox');
  });
});
