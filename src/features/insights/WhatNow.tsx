import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { focusPath, PATHS } from '@/app/routing';
import { clock } from '@/data';
import { useAi } from '@/features/cloud/slots';
import { useFormat } from '@/i18n/useFormat';
import { Button, buttonClass, Card, Icon, IconButton } from '@/ui';
import { useCurrentEnergy } from './energy';
import { pickAt, rankPicks, usePickPool, type QuestPick } from './whatNow';

/**
 * "What should I do now?": one button. The pick appears at once from the local rule; when
 * AI is available, its one-line reason replaces the local one as soon as it arrives.
 */
export function WhatNow() {
  const { t } = useTranslation('insights');
  const [open, setOpen] = useState(false);
  const [skips, setSkips] = useState(0);
  const [order, setOrder] = useState<QuestPick[] | null>(null);
  const pool = usePickPool();
  const energy = useCurrentEnergy();
  const openerRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // The ranking is frozen when the player asks, so "Not this one" walks a stable list even
  // while data changes underneath. A finished or removed quest drops out of it.
  const ranked = useMemo(() => {
    if (!order || !pool) return order ?? [];
    const alive = new Map(pool.candidates.map((c) => [c.id, c]));
    return order
      .filter((p) => alive.has(p.quest.id))
      .map((p) => ({ ...p, quest: alive.get(p.quest.id)! }));
  }, [order, pool]);

  if (!pool || energy === undefined) return null;

  const ask = () => {
    setOrder(rankPicks(pool.candidates, clock.now(), energy));
    setSkips(0);
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => openerRef.current?.focus());
  };

  if (!open) {
    return (
      <Button
        ref={openerRef}
        variant="soft"
        size="lg"
        icon="sparkle"
        onClick={ask}
        className="w-full justify-start sm:w-auto"
        aria-expanded={false}
      >
        {t('what_now.button')}
      </Button>
    );
  }

  const pick = pickAt(ranked, skips);
  return (
    <WhatNowCard
      pick={pick}
      count={ranked.length}
      backlogCount={pool.backlogCount}
      titleRef={titleRef}
      onNext={() => {
        setSkips((s) => s + 1);
        requestAnimationFrame(() => titleRef.current?.focus());
      }}
      onClose={close}
    />
  );
}

function WhatNowCard({
  pick,
  count,
  backlogCount,
  titleRef,
  onNext,
  onClose,
}: {
  pick: QuestPick | null;
  count: number;
  backlogCount: number;
  titleRef: React.RefObject<HTMLHeadingElement | null>;
  onNext: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation('insights');
  const format = useFormat();
  const navigate = useNavigate();
  const headingId = useId();
  const [onlyOne, setOnlyOne] = useState(false);
  const aiLine = useAiReason(pick);

  useEffect(() => {
    titleRef.current?.focus();
  }, [titleRef]);

  const closeButton = (
    <IconButton icon="close" label={t('what_now.close')} onClick={onClose} className="shrink-0" />
  );

  if (!pick) {
    return (
      <Card tone="highlight" className="flex flex-col gap-3" data-testid="what-now">
        <div className="flex items-start gap-3">
          <h2
            id={headingId}
            ref={titleRef}
            tabIndex={-1}
            className="min-w-0 flex-1 text-xl font-semibold outline-none"
          >
            {t('what_now.empty_title')}
          </h2>
          {closeButton}
        </div>
        <p className="text-muted">
          {backlogCount > 0 ? t('what_now.empty_backlog') : t('what_now.empty_new')}
        </p>
        <div>
          {backlogCount > 0 ? (
            <Link to={PATHS.quests} className={buttonClass('primary')}>
              {t('what_now.open_backlog')}
            </Link>
          ) : (
            <Link to="/quests/new?from=today" className={buttonClass('primary')}>
              <Icon name="plus" />
              {t('what_now.add_quest')}
            </Link>
          )}
        </div>
      </Card>
    );
  }

  const { quest } = pick;
  const step = quest.nextStep;
  const showStep = !(step.title === quest.title && !step.guess_minutes);
  const localReason = t(`reason.${pick.reasons[0] ?? 'already_active'}`);

  return (
    <Card
      as="section"
      tone="highlight"
      aria-labelledby={headingId}
      className="flex flex-col gap-3"
      data-testid="what-now"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-bold text-primary">
            <Icon name="sparkle" filled />
            {t('what_now.eyebrow')}
          </p>
          <h2
            id={headingId}
            ref={titleRef}
            tabIndex={-1}
            className="mt-0.5 text-xl font-semibold break-words outline-none"
          >
            {quest.title}
          </h2>
        </div>
        {closeButton}
      </div>
      {showStep && (
        <p className="text-sm text-muted break-words">
          {t('what_now.next_step', { step: step.title })}
          {step.guess_minutes ? ` · ${format.duration(step.guess_minutes * 60_000)}` : ''}
        </p>
      )}
      <p className="text-text" aria-live="polite" data-testid="what-now-reason">
        {aiLine ? (
          <>
            <span className="ql-visually-hidden">{t('what_now.ai_label')}: </span>
            {aiLine}
          </>
        ) : (
          localReason
        )}
      </p>
      {onlyOne && (
        <p className="text-sm text-muted" role="status">
          {t('what_now.only_one')}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button icon="play" onClick={() => navigate(focusPath({ stepId: step.id }))}>
          {t('what_now.start')}
          <span className="ql-visually-hidden">: {quest.title}</span>
        </Button>
        <Button
          variant="ghost"
          icon="refresh"
          onClick={() => {
            if (count <= 1) setOnlyOne(true);
            else onNext();
          }}
        >
          {t('what_now.not_this')}
        </Button>
      </div>
    </Card>
  );
}

/** The AI's one-line reason for a pick, fetched in the background (null until it arrives). */
function useAiReason(pick: QuestPick | null): string | null {
  const { t, i18n } = useTranslation('insights');
  const ai = useAi();
  const [lines, setLines] = useState<Record<string, string>>({});
  const asked = useRef(new Set<string>());
  const title = pick?.quest.title ?? '';
  const reasons = pick?.reasons.join(',') ?? '';
  const key = pick ? `${i18n.language}|${pick.quest.id}|${title}|${reasons}` : null;

  useEffect(() => {
    if (!key || !ai.available || asked.current.has(key)) return;
    asked.current.add(key);
    const phrases = reasons
      .split(',')
      .filter(Boolean)
      .slice(0, 3)
      .map((r) => t(`reason.${r as 'due_today'}`));
    ai.explainPick({ questTitle: title, reasons: phrases })
      .then((line) => {
        const text = line.trim();
        if (text) setLines((m) => ({ ...m, [key]: text }));
      })
      .catch(() => {
        /* the local reason stays; AI is optional */
      });
  }, [ai, key, title, reasons, t]);

  return key ? (lines[key] ?? null) : null;
}
