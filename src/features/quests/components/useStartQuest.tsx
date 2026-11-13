import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { focusPath } from '@/app/routing';
import type { Uuid } from '@/data';
import { showToast } from '@/ui';
import { activateQuest, firstOpenStep, swapActive } from '../model/actions';
import { SwapSheet, type Pending } from './SwapSheet';

/**
 * Starting or activating a quest. When Active is full, the swap sheet opens: one tap sends
 * an active quest back to the backlog (progress kept) and swaps this one in (and starts it).
 * Render the returned `sheet` once in the page.
 */
export function useStartQuest() {
  const { t } = useTranslation('quests');
  const navigate = useNavigate();
  const [pending, setPending] = useState<Pending | null>(null);

  const goFocus = async (questId: Uuid) => {
    const step = await firstOpenStep(questId);
    navigate(step ? focusPath({ stepId: step.id }) : `/quests/${questId}`);
  };

  const start = async (quest: { id: Uuid; title: string }, options: { focus?: boolean } = {}) => {
    const focus = options.focus ?? true;
    const result = await activateQuest(quest.id);
    if (result === 'full') {
      setPending({ questId: quest.id, title: quest.title, focus });
      return;
    }
    if (focus) await goFocus(quest.id);
    else if (result === 'activated')
      showToast({
        title: t('toast.activated', { title: quest.title }),
        tone: 'success',
        icon: 'today',
      });
  };

  const sheet = (
    <SwapSheet
      pending={pending}
      onClose={() => setPending(null)}
      onSwap={async (outId) => {
        if (!pending) return;
        await swapActive(outId, pending.questId);
        setPending(null);
        if (pending.focus) await goFocus(pending.questId);
        else
          showToast({
            title: t('toast.activated', { title: pending.title }),
            tone: 'success',
            icon: 'today',
          });
      }}
    />
  );

  return { start, sheet };
}
