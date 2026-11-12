import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { focusPath } from '@/app/routing';
import { useSettings, type Uuid } from '@/data';
import { useFormat } from '@/i18n/useFormat';
import { Button, Icon, Sheet, showToast } from '@/ui';
import { useQuestList } from '../hooks';
import { activateQuest, firstOpenStep, swapActive } from '../model/actions';

interface Pending {
  questId: Uuid;
  title: string;
  focus: boolean;
}

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
      showToast({ title: t('toast.activated', { title: quest.title }), tone: 'success', icon: 'today' });
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

function SwapSheet({
  pending,
  onClose,
  onSwap,
}: {
  pending: Pending | null;
  onClose: () => void;
  onSwap: (outId: Uuid) => Promise<void>;
}) {
  const { t } = useTranslation('quests');
  const { number } = useFormat();
  const settings = useSettings();
  const active = useQuestList('active');
  const [busy, setBusy] = useState<Uuid | null>(null);

  return (
    <Sheet
      open={!!pending}
      onClose={onClose}
      title={t('swap.title')}
      description={t('swap.body', {
        limit: number(settings?.active_limit ?? 3),
        title: pending?.title ?? '',
      })}
      footer={
        <Button variant="ghost" onClick={onClose}>
          {t('actions.cancel')}
        </Button>
      }
    >
      <ul className="flex flex-col gap-2">
        {(active ?? []).map(({ quest, steps }) => {
          const done = steps.filter((s) => s.done_at !== null).length;
          return (
            <li key={quest.id}>
              <button
                type="button"
                disabled={busy !== null}
                aria-label={t('swap.swap_for', { title: quest.title })}
                onClick={async () => {
                  setBusy(quest.id);
                  try {
                    await onSwap(quest.id);
                  } finally {
                    setBusy(null);
                  }
                }}
                className="flex min-h-14 w-full items-center gap-3 rounded-lg border border-border bg-surface-2 px-4 py-3 text-start transition-colors hover:border-primary/50 hover:bg-primary-soft disabled:opacity-60"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-text">{quest.title}</span>
                  <span className="block text-sm text-muted">
                    {t('progress.steps', {
                      done: number(done),
                      total: number(steps.length),
                      count: steps.length,
                    })}
                  </span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-primary">
                  <Icon name="archive" size="1.1em" />
                  {t('swap.rest')}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
