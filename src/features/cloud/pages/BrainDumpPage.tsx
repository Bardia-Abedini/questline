import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { PATHS } from '@/app/routing';
import { createQuest, writeTransaction } from '@/data';
import type { Difficulty, Priority } from '@/domain/types';
import { useFormat } from '@/i18n/useFormat';
import { events } from '@/services';
import {
  Button,
  buttonClass,
  Card,
  Icon,
  IconButton,
  Input,
  Page,
  Select,
  showToast,
  Textarea,
} from '@/ui';
import { LIMITS } from '../../../../supabase/functions/_shared/ai.ts';
import { AiUnavailableError, type AiQuestSuggestion, type AiStatus } from '../aiTypes';
import { useAi } from '../slots';

const PRIORITIES: Priority[] = ['high', 'medium', 'low'];
const DIFFICULTIES: Difficulty[] = ['E', 'D', 'C', 'B', 'A', 'S'];

interface Draft extends AiQuestSuggestion {
  key: number;
}

let nextKey = 1;

/** Without AI: one quest per line (bullets and numbers removed). */
export function splitLines(text: string): AiQuestSuggestion[] {
  return text
    .split(/\r?\n|;|؛/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter((l) => l.length > 0)
    .slice(0, 50)
    .map((title) => ({
      title: title.slice(0, LIMITS.title),
      priority: 'medium' as const,
      difficulty: 'C' as const,
      guessMinutes: 30,
      steps: [],
    }));
}

function Unavailable({ status }: { status: Exclude<AiStatus, 'ready'> }) {
  const { t } = useTranslation('cloud');
  return (
    <Card tone="sunken" className="flex items-start gap-3" data-testid="ai-unavailable">
      <Icon name="lantern" className="mt-1 shrink-0 text-primary" size={22} />
      <div className="min-w-0">
        <p className="font-bold text-text">{t(`ai.unavailable_${status}`)}</p>
        <p className="text-sm text-muted">{t(`ai.unavailable_${status}_hint`)}</p>
        {status === 'guest' && (
          <Link to="/account" className={`${buttonClass('soft', 'sm')} mt-2`}>
            {t('ai.go_to_account')}
          </Link>
        )}
      </div>
    </Card>
  );
}

export function BrainDumpPage() {
  const { t } = useTranslation('cloud');
  const { number } = useFormat();
  const ai = useAi();
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const tooLong = text.length > LIMITS.brainDump;

  const review = (list: AiQuestSuggestion[]) =>
    setDrafts(list.map((q) => ({ ...q, key: nextKey++ })));

  const sort = async () => {
    setBusy(true);
    try {
      const quests = await ai.brainDump({ text });
      if (quests.length === 0) showToast({ tone: 'info', title: t('brain_dump.nothing_found') });
      review(quests);
    } catch (error) {
      showToast({
        tone: 'warning',
        icon: 'alert',
        title:
          error instanceof AiUnavailableError
            ? t(`ai.unavailable_${error.status}`)
            : t('ai.failed'),
      });
    } finally {
      setBusy(false);
    }
  };

  const update = (key: number, patch: Partial<AiQuestSuggestion>) =>
    setDrafts((d) => d!.map((q) => (q.key === key ? { ...q, ...patch } : q)));

  const save = async () => {
    const list = drafts!.filter((q) => q.title.trim());
    setSaving(true);
    try {
      await writeTransaction(['quests', 'steps'], async () => {
        for (const q of list) {
          const { quest } = await createQuest({
            title: q.title.trim(),
            notes: q.notes ?? '',
            priority: q.priority,
            difficulty: q.difficulty,
            guess_minutes: q.guessMinutes,
            status: 'backlog',
            source: 'brain_dump',
            steps: q.steps
              .filter((s) => s.title.trim())
              .map((s) => ({
                title: s.title.trim(),
                guess_minutes: s.guessMinutes,
                quick: s.quick,
                quick_source: 'ai' as const,
              })),
          });
          events.emitAfterCommit('quest.created', { questId: quest.id, source: 'brain_dump' });
        }
      });
      showToast({
        tone: 'success',
        icon: 'sparkle',
        title: t('brain_dump.saved', { count: list.length, n: number(list.length) }),
      });
      navigate(PATHS.quests);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page title={t('brain_dump.title')} subtitle={t('brain_dump.subtitle')}>
      {drafts === null ? (
        <>
          {!ai.available && <Unavailable status={ai.status as Exclude<AiStatus, 'ready'>} />}
          <Card className="flex flex-col gap-3">
            <Textarea
              label={t('brain_dump.label')}
              placeholder={t('brain_dump.placeholder')}
              rows={9}
              value={text}
              onChange={(e) => setText(e.target.value)}
              hint={t('brain_dump.count', {
                n: number(text.length),
                max: number(LIMITS.brainDump),
              })}
              error={tooLong ? t('brain_dump.too_long') : undefined}
            />
            <div className="flex flex-wrap gap-2">
              {ai.available && (
                <Button
                  icon="sparkle"
                  loading={busy}
                  disabled={!text.trim() || tooLong}
                  onClick={() => void sort()}
                >
                  {t('brain_dump.sort')}
                </Button>
              )}
              <Button
                variant={ai.available ? 'ghost' : 'primary'}
                disabled={!text.trim() || busy}
                onClick={() => review(splitLines(text))}
              >
                {t('brain_dump.split_lines')}
              </Button>
            </div>
          </Card>
        </>
      ) : (
        <>
          <p className="text-muted">
            {t('brain_dump.review_hint', { count: drafts.length, n: number(drafts.length) })}
          </p>
          <ul className="flex flex-col gap-3" aria-label={t('brain_dump.review_label')}>
            {drafts.map((q, i) => (
              <Card as="li" key={q.key} className="flex flex-col gap-3">
                <div className="flex items-end gap-2">
                  <Input
                    wrapperClassName="min-w-0 flex-1"
                    label={t('brain_dump.quest_title', { n: number(i + 1) })}
                    value={q.title}
                    maxLength={LIMITS.title}
                    onChange={(e) => update(q.key, { title: e.target.value })}
                  />
                  <IconButton
                    icon="trash"
                    variant="ghost"
                    label={t('brain_dump.remove_quest', { title: q.title })}
                    onClick={() => setDrafts((d) => d!.filter((x) => x.key !== q.key))}
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
                  <Select
                    label={t('brain_dump.priority')}
                    value={q.priority}
                    onChange={(e) => update(q.key, { priority: e.target.value as Priority })}
                    options={PRIORITIES.map((p) => ({ value: p, label: t(`priority.${p}`) }))}
                  />
                  <Select
                    label={t('brain_dump.difficulty')}
                    value={q.difficulty}
                    onChange={(e) => update(q.key, { difficulty: e.target.value as Difficulty })}
                    options={DIFFICULTIES.map((d) => ({ value: d, label: d }))}
                  />
                  <Input
                    label={t('brain_dump.guess')}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={480}
                    value={q.guessMinutes}
                    onChange={(e) =>
                      update(q.key, { guessMinutes: Math.max(1, Number(e.target.value) || 1) })
                    }
                  />
                </div>
                {q.steps.length > 0 && (
                  <fieldset className="flex flex-col gap-2">
                    <legend className="mb-1 text-sm font-bold text-muted">
                      {t('brain_dump.steps')}
                    </legend>
                    {q.steps.map((s, si) => (
                      <div key={si} className="flex items-end gap-2">
                        <Input
                          wrapperClassName="min-w-0 flex-1"
                          label={t('brain_dump.step', {
                            n: number(si + 1),
                            minutes: number(s.guessMinutes),
                          })}
                          value={s.title}
                          onChange={(e) =>
                            update(q.key, {
                              steps: q.steps.map((x, xi) =>
                                xi === si ? { ...x, title: e.target.value } : x,
                              ),
                            })
                          }
                        />
                        <IconButton
                          icon="close"
                          variant="ghost"
                          size="sm"
                          label={t('brain_dump.remove_step', { title: s.title })}
                          onClick={() =>
                            update(q.key, { steps: q.steps.filter((_, xi) => xi !== si) })
                          }
                        />
                      </div>
                    ))}
                  </fieldset>
                )}
              </Card>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button
              icon="check"
              loading={saving}
              disabled={drafts.length === 0}
              onClick={() => void save()}
            >
              {t('brain_dump.save', { count: drafts.length, n: number(drafts.length) })}
            </Button>
            <Button variant="ghost" onClick={() => setDrafts(null)}>
              {t('brain_dump.back')}
            </Button>
          </div>
        </>
      )}
    </Page>
  );
}
