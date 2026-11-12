import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { setLanguage } from '@/i18n';
import { mockBrainDump, mockBreakDown, createMockAiClient, mockSuggestMeta } from './aiMock';
import { AI_MOCK_FLAG, AiUnavailableError } from './aiTypes';
import { useAi } from './slots';

afterEach(async () => {
  localStorage.removeItem(AI_MOCK_FLAG);
  await setLanguage('en');
});

describe('useAi placeholder', () => {
  it('is a guest client that rejects every method with AiUnavailableError', async () => {
    const { result } = renderHook(() => useAi());
    const ai = result.current;
    expect(ai.status).toBe('guest');
    expect(ai.available).toBe(false);
    const calls = [
      ai.breakDown({ title: 'x' }),
      ai.splitStep({ questTitle: 'x', stepTitle: 'y' }),
      ai.suggestMeta({ title: 'x' }),
      ai.classifyQuick({ steps: [] }),
      ai.brainDump({ text: 'x' }),
      ai.explainPick({ questTitle: 'x', reasons: [] }),
    ];
    for (const call of calls) {
      const error = await call.catch((e: unknown) => e);
      expect(error).toBeInstanceOf(AiUnavailableError);
      expect((error as AiUnavailableError).status).toBe('guest');
    }
  });

  it('uses the mock when localStorage["ql.ai.mock"] is "1"', () => {
    localStorage.setItem(AI_MOCK_FLAG, '1');
    const { result } = renderHook(() => useAi());
    expect(result.current.status).toBe('ready');
    expect(result.current.available).toBe(true);
  });
});

describe('AI mock', () => {
  const ai = createMockAiClient(0);

  it('breaks a quest into 3 to 7 steps, first under 5 minutes, deterministically', async () => {
    for (const title of [
      'Essay',
      'Clean the kitchen',
      'Study for the biology exam',
      'Tax',
      'Pack',
    ]) {
      const steps = await ai.breakDown({ title });
      expect(steps.length).toBeGreaterThanOrEqual(3);
      expect(steps.length).toBeLessThanOrEqual(7);
      expect(steps[0]!.guessMinutes).toBeLessThan(5);
      expect(steps[0]!.quick).toBe(true);
      expect(steps[0]!.title).toContain(title);
      expect(mockBreakDown(title)).toEqual(steps);
    }
  });

  it('splits a step into smaller ones', async () => {
    const steps = await ai.splitStep({
      questTitle: 'Essay',
      stepTitle: 'Write intro',
      guessMinutes: 20,
    });
    expect(steps).toHaveLength(3);
    expect(steps[0]!.guessMinutes).toBeLessThan(5);
    expect(steps.every((s) => s.title.includes('Write intro'))).toBe(true);
  });

  it('suggests meta from the text', async () => {
    expect(await ai.suggestMeta({ title: 'Biology exam tomorrow' })).toMatchObject({
      priority: 'high',
    });
    expect(mockSuggestMeta('Tea')).toEqual({ priority: 'low', difficulty: 'E', guessMinutes: 10 });
    expect(
      mockSuggestMeta('one two three four five six seven eight nine ten eleven twelve').difficulty,
    ).toBe('S');
  });

  it('classifies quick steps with the 5-minute rule', async () => {
    expect(
      await ai.classifyQuick({
        steps: [
          { title: 'a', guessMinutes: 3 },
          { title: 'b', guessMinutes: 20 },
          { title: 'c', guessMinutes: null },
        ],
      }),
    ).toEqual([true, false, false]);
  });

  it('turns a messy list into quests', async () => {
    const quests = await ai.brainDump({
      text: '- buy milk\n\n2. finish essay draft; call grandma\n  ',
    });
    expect(quests.map((q) => q.title)).toEqual(['buy milk', 'finish essay draft', 'call grandma']);
    for (const q of quests) expect(q.steps.length).toBeGreaterThanOrEqual(3);
    expect(mockBrainDump('')).toEqual([]);
  });

  it('explains a pick in one line', async () => {
    const line = await ai.explainPick({
      questTitle: 'Essay',
      reasons: ['due today', 'high priority'],
    });
    expect(line).toBe('“Essay” is a good pick now: due today, high priority.');
    expect(line).not.toContain('\n');
    expect(await ai.explainPick({ questTitle: 'Essay', reasons: [] })).toContain('Essay');
  });

  it('answers in Persian when the language is Persian', async () => {
    await setLanguage('fa');
    const [first] = await ai.breakDown({ title: 'مقاله' });
    expect(first!.title).toBe('وسایل لازم برای «مقاله» را جمع کن');
    expect(await ai.explainPick({ questTitle: 'مقاله', reasons: ['امروز', 'مهم'] })).toBe(
      '«مقاله» الان انتخاب خوبی است: امروز، مهم.',
    );
  });

  it('waits a little before answering (visible loading states)', async () => {
    const slow = createMockAiClient(30);
    const start = performance.now();
    await slow.suggestMeta({ title: 'x' });
    expect(performance.now() - start).toBeGreaterThanOrEqual(25);
  });
});
