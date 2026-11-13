import { beforeEach, describe, expect, it } from 'vitest';
import { resetAll } from '@/test/db';
import {
  db,
  ensureLocalData,
  listSteps,
  questsRepo,
  recurrenceRulesRepo,
  setClock,
  type Quest,
} from '@/data';
import { completeQuest } from '@/services';
import { sequenceRng } from '@/domain/rng';
import {
  archiveQuest,
  createQuestFromDraft,
  deleteQuest,
  draftFromQuest,
  updateQuestFromDraft,
} from './actions';
import { emptyDraft, makeStep, type QuestDraft } from './draft';
import { advanceRule, rollRecurrences } from './recurrence';

// 2026-03-10 is a Tuesday. Tests run with TZ=UTC.
const T0 = Date.parse('2026-03-10T09:00:00.000Z');
const noLoot = () => sequenceRng([0.99]);

beforeEach(async () => {
  await resetAll();
  setClock(T0);
  await ensureLocalData();
});

function draft(patch: Partial<QuestDraft> = {}): QuestDraft {
  return { ...emptyDraft(), title: 'Water plants', ...patch };
}

async function openOccurrences(ruleId: string): Promise<Quest[]> {
  return (await questsRepo.list((q) => q.recurrence_rule_id === ruleId)).filter((q) =>
    ['active', 'backlog'].includes(q.status),
  );
}

describe('recurring quests', () => {
  it('creates the first occurrence for today with the series template', async () => {
    const { quest } = await createQuestFromDraft(
      draft({
        recurrence: { kind: 'daily', weekdays: [], interval: '2' },
        steps: [makeStep('Fill can', 2)],
      }),
      { activate: true },
    );
    expect(quest).toMatchObject({
      source: 'recurrence',
      occurrence_date: '2026-03-10',
      due_date: '2026-03-10',
      status: 'active',
    });
    const rule = (await recurrenceRulesRepo.get(quest.recurrence_rule_id!))!;
    expect(rule).toMatchObject({ kind: 'daily', current_quest_id: quest.id, active: true });
    expect((await listSteps(quest.id)).map((s) => s.title)).toEqual(['Fill can']);
  });

  it('finishing an occurrence creates the next one', async () => {
    const { quest } = await createQuestFromDraft(
      draft({ recurrence: { kind: 'daily', weekdays: [], interval: '2' } }),
      { activate: true },
    );
    await completeQuest(quest.id, { rng: noLoot() });
    const next = await advanceRule(quest.recurrence_rule_id!, '2026-03-10');
    expect(next).toMatchObject({ occurrence_date: '2026-03-11', status: 'backlog' });
    // Calling again changes nothing.
    expect(await advanceRule(quest.recurrence_rule_id!, '2026-03-10')).toBeNull();
    expect(await openOccurrences(quest.recurrence_rule_id!)).toHaveLength(1);
  });

  it('a backlog occurrence moves to Active on its day when there is room', async () => {
    const { quest } = await createQuestFromDraft(
      draft({ recurrence: { kind: 'daily', weekdays: [], interval: '2' } }),
      { activate: true },
    );
    await completeQuest(quest.id, { rng: noLoot() });
    await rollRecurrences('2026-03-10');
    setClock(Date.parse('2026-03-11T08:00:00.000Z'));
    await rollRecurrences('2026-03-11');
    const [open] = await openOccurrences(quest.recurrence_rule_id!);
    expect(open).toMatchObject({ occurrence_date: '2026-03-11', status: 'active' });
  });

  it('missed days never pile up: the open occurrence moves forward with its progress', async () => {
    const { quest } = await createQuestFromDraft(
      draft({
        recurrence: { kind: 'weekdays', weekdays: [1, 3], interval: '2' }, // Mon, Wed
        steps: [makeStep('a'), makeStep('b')],
      }),
      { activate: true },
    );
    expect(quest.occurrence_date).toBe('2026-03-11');
    const [a] = await listSteps(quest.id);
    await db.steps.update(a!.id, { done_at: '2026-03-11T10:00:00.000Z' });
    // Away for a week and a half.
    await rollRecurrences('2026-03-20');
    const open = await openOccurrences(quest.recurrence_rule_id!);
    expect(open).toHaveLength(1);
    expect(open[0]).toMatchObject({
      id: quest.id,
      occurrence_date: '2026-03-23',
      due_date: '2026-03-23',
    });
    expect((await listSteps(quest.id))[0]!.done_at).not.toBeNull();
  });

  it('every N days counts from the anchor', async () => {
    const { quest } = await createQuestFromDraft(
      draft({
        dueDate: '2026-03-08',
        recurrence: { kind: 'every_n_days', weekdays: [], interval: '3' },
      }),
    );
    expect(quest.occurrence_date).toBe('2026-03-11');
    await completeQuest(quest.id, { rng: noLoot() });
    expect(await advanceRule(quest.recurrence_rule_id!, '2026-03-10')).toMatchObject({
      occurrence_date: '2026-03-14',
    });
  });

  it('archiving skips to the next occurrence; deleting stops the series', async () => {
    const { quest } = await createQuestFromDraft(
      draft({ recurrence: { kind: 'weekly', weekdays: [], interval: '2' } }),
    );
    await archiveQuest(quest.id);
    const next = (await advanceRule(quest.recurrence_rule_id!, '2026-03-10'))!;
    expect(next.occurrence_date).toBe('2026-03-17');
    await deleteQuest(next.id);
    expect(await advanceRule(quest.recurrence_rule_id!, '2026-03-10')).toBeNull();
    expect((await recurrenceRulesRepo.get(quest.recurrence_rule_id!))!.active).toBe(false);
  });

  it('editing can add or stop a recurrence', async () => {
    const { quest } = await createQuestFromDraft(draft());
    const d = (await draftFromQuest(quest.id))!;
    await updateQuestFromDraft(quest.id, {
      ...d,
      recurrence: { kind: 'daily', weekdays: [], interval: '2' },
    });
    const withRule = (await questsRepo.get(quest.id))!;
    expect(withRule.recurrence_rule_id).not.toBeNull();
    expect(withRule.due_date).toBe('2026-03-10');
    const d2 = (await draftFromQuest(quest.id))!;
    expect(d2.recurrence.kind).toBe('daily');
    await updateQuestFromDraft(quest.id, { ...d2, recurrence: { ...d2.recurrence, kind: 'none' } });
    expect((await questsRepo.get(quest.id))!.recurrence_rule_id).toBeNull();
    expect((await recurrenceRulesRepo.get(withRule.recurrence_rule_id!))!.active).toBe(false);
  });
});
