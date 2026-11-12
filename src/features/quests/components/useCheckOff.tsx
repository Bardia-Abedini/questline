import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { focusPath } from '@/app/routing';
import { needsNoTimerWarning } from '@/domain/steps';
import type { Quest, Step } from '@/data';
import { useFormat } from '@/i18n/useFormat';
import { completeStep, reopenStep, type CompleteStepResult } from '@/services';
import { Button, Modal, showToast } from '@/ui';
import { hadFocusSession, markNoTimerWarned } from '../model/actions';

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
