import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { focusPath } from '@/app/routing';
import { needsNoTimerWarning } from '@/domain/steps';
import { useAi, type AiStepSuggestion } from '@/features/cloud/slots';
import type { Quest, Step } from '@/data';
import { useFormat } from '@/i18n/useFormat';
import { completeStep, reopenStep, type CompleteStepResult } from '@/services';
import { Button, Chip, cx, Icon, IconButton, Modal, Sheet, showToast, Spinner } from '@/ui';
import { hadFocusSession, markNoTimerWarned, splitStepInto } from '../model/actions';
import { useAiErrorToast } from './aiErrors';

/** Toast for a finished quest (the 40% bonus). Step rewards show through Game's effects. */
export function useQuestFinishedToast() {
  const { t } = useTranslation('quests');
  const { number } = useFormat();
  return (result: CompleteStepResult, title: string) => {
    const done = result.questCompletion;
    if (!done?.changed) return;
    const total = (done.grant?.total.xp ?? 0) + (result.grant?.total.xp ?? 0);
    const gold = (done.grant?.total.gold ?? 0) + (result.grant?.total.gold ?? 0);
    showToast({
      title: t('toast.quest_done', { title }),
      description: t('toast.quest_done_reward', { xp: number(total), gold: number(gold) }),
      tone: 'success',
      icon: 'star',
      duration: 6000,
    });
  };
}

/**
 * Checking off a step from anywhere in Quests: quick steps go straight through; a non-quick
 * step with no focus session gets the one-time friendly warning. Never blocked.
 */
export function useCheckOff(quest: Pick<Quest, 'title'>) {
  const { t } = useTranslation('quests');
  const navigate = useNavigate();
  const finishedToast = useQuestFinishedToast();
  const [warn, setWarn] = useState<Step | null>(null);

  const complete = async (step: Step, confirmedWithoutTimer = false) => {
    const result = await completeStep(step.id, { confirmedWithoutTimer });
    finishedToast(result, quest.title);
  };

  const toggle = async (step: Step) => {
    if (step.done_at !== null) {
      await reopenStep(step.id);
      return;
    }
    if (step.quick) return complete(step);
    const warned = step.no_timer_warned_at !== null;
    const had = await hadFocusSession(step.id);
    if (needsNoTimerWarning({ quick: step.quick, hadFocusSession: had, alreadyWarned: warned })) {
      await markNoTimerWarned(step.id);
      setWarn(step);
      return;
    }
    return complete(step);
  };

  const dialog = (
    <Modal
      open={!!warn}
      onClose={() => setWarn(null)}
      size="sm"
      title={t('no_timer.title')}
      description={t('no_timer.body', { step: warn?.title ?? '' })}
      footer={
        <>
          <Button
            variant="secondary"
            icon="timer"
            onClick={() => {
              const step = warn;
              setWarn(null);
              if (step) navigate(focusPath({ stepId: step.id }));
            }}
          >
            {t('no_timer.start_timer')}
          </Button>
          <Button
            icon="check"
            onClick={async () => {
              const step = warn;
              setWarn(null);
              if (step) await complete(step, true);
            }}
          >
            {t('no_timer.confirm')}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted">{t('no_timer.note')}</p>
    </Modal>
  );

  return { toggle, dialog };
}

interface StepChecklistProps {
  quest: Quest;
  steps: Step[];
}

/** The quest detail step list: checkboxes, start per step, guess vs actual, "I'm stuck". */
export function StepChecklist({ quest, steps }: StepChecklistProps) {
  const { t } = useTranslation('quests');
  const format = useFormat();
  const navigate = useNavigate();
  const ai = useAi();
  const aiError = useAiErrorToast();
  const { toggle, dialog } = useCheckOff(quest);
  const [stuck, setStuck] = useState<{ step: Step; parts: AiStepSuggestion[] | null } | null>(
    null,
  );
  const [busy, setBusy] = useState<string | null>(null);
  const finished = quest.status === 'done';
  const firstOpen = steps.find((s) => s.done_at === null);

  const askSplit = async (step: Step) => {
    setStuck({ step, parts: null });
    try {
      const parts = await ai.splitStep({
        questTitle: quest.title,
        stepTitle: step.title,
        guessMinutes: step.guess_minutes ?? undefined,
      });
      setStuck((s) => (s && s.step.id === step.id ? { step, parts } : s));
    } catch (error) {
      setStuck(null);
      aiError(error);
    }
  };

  return (
    <>
      <ol className="flex flex-col gap-2" aria-label={t('detail.steps')}>
        {steps.map((step, index) => {
          const done = step.done_at !== null;
          const guess = step.guess_minutes ? format.duration(step.guess_minutes * 60_000) : null;
          const actual = step.actual_ms > 0 ? format.duration(step.actual_ms) : null;
          const id = `step-${step.id}`;
          return (
            <li
              key={step.id}
              className={cx(
                'flex items-start gap-3 rounded-lg border px-3 py-3 sm:px-4',
                done
                  ? 'border-transparent bg-surface-2'
                  : step === firstOpen
                    ? 'border-primary/40 bg-surface shadow-sm'
                    : 'border-border bg-surface',
              )}
            >
              <input
                id={id}
                type="checkbox"
                checked={done}
                disabled={busy === step.id}
                onChange={async () => {
                  setBusy(step.id);
                  try {
                    await toggle(step);
                  } finally {
                    setBusy(null);
                  }
                }}
                className="mt-0.5 size-6 shrink-0 cursor-pointer accent-[var(--ql-accent)]"
              />
              <div className="min-w-0 flex-1">
                <label
                  htmlFor={id}
                  className={cx(
                    'block cursor-pointer font-bold break-words',
                    done ? 'text-muted line-through decoration-2' : 'text-text',
                  )}
                >
                  <span className="ql-visually-hidden">
                    {t('detail.step_number', { n: format.number(index + 1) })}
                  </span>
                  {step.title}
                </label>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                  {done ? (
                    guess || actual ? (
                      <span>
                        {guess && actual
                          ? t('estimate.guess_vs_actual', { guess, actual })
                          : guess
                            ? t('estimate.guess_only', { guess })
                            : t('estimate.actual_only', { actual })}
                      </span>
                    ) : null
                  ) : (
                    <>
                      {guess && (
                        <span className="inline-flex items-center gap-1">
                          <Icon name="timer" size="1em" />
                          {guess}
                        </span>
                      )}
                      {step.quick && (
                        <Chip size="sm" tone="success" icon="bolt">
                          {t('step.quick')}
                        </Chip>
                      )}
                      {ai.available && !finished && (
                        <button
                          type="button"
                          onClick={() => askSplit(step)}
                          className="inline-flex min-h-8 items-center gap-1 rounded-md px-1.5 font-bold text-primary hover:bg-primary-soft"
                          aria-label={t('stuck.button_for', { step: step.title })}
                        >
                          <Icon name="sparkle" size="1em" />
                          {t('stuck.button')}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
              {!done && !finished && (
                <IconButton
                  icon="play"
                  size="sm"
                  variant={step === firstOpen ? 'soft' : 'ghost'}
                  label={t('detail.start_step', { step: step.title })}
                  onClick={() => navigate(focusPath({ stepId: step.id }))}
                />
              )}
            </li>
          );
        })}
      </ol>
      {dialog}
      <Sheet
        open={!!stuck}
        onClose={() => setStuck(null)}
        title={t('stuck.title')}
        description={stuck ? t('stuck.body', { step: stuck.step.title }) : undefined}
        footer={
          stuck?.parts ? (
            <>
              <Button variant="ghost" onClick={() => setStuck(null)}>
                {t('actions.cancel')}
              </Button>
              <Button variant="secondary" icon="refresh" onClick={() => askSplit(stuck.step)}>
                {t('ai.try_again')}
              </Button>
              <Button
                icon="check"
                onClick={async () => {
                  const s = stuck;
                  setStuck(null);
                  if (s?.parts)
                    await splitStepInto(
                      s.step.id,
                      s.parts.map((p) => ({
                        title: p.title,
                        guessMinutes: p.guessMinutes,
                        quick: p.quick,
                      })),
                    );
                }}
              >
                {t('stuck.use')}
              </Button>
            </>
          ) : undefined
        }
      >
        {stuck && !stuck.parts ? (
          <div className="flex items-center gap-3 py-4 text-muted">
            <Spinner label={t('ai.thinking')} />
            <span aria-hidden>{t('ai.thinking')}</span>
          </div>
        ) : (
          <ol className="flex flex-col gap-2">
            {stuck?.parts?.map((p, i) => (
              <li key={i} className="flex items-start gap-3 rounded-md bg-surface-2 px-3 py-2">
                <span className="mt-0.5 text-sm font-bold text-muted">{format.number(i + 1)}</span>
                <span className="min-w-0 flex-1 break-words">{p.title}</span>
                <span className="shrink-0 text-sm text-muted">
                  {format.duration(p.guessMinutes * 60_000)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Sheet>
    </>
  );
}
