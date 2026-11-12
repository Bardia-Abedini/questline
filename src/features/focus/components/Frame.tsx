import type { ReactNode, Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { PATHS } from '@/app/routing';
import { QuickCaptureSlot } from '@/features/quests/slots';
import { useFormat } from '@/i18n/useFormat';
import { Chip, cx, IconButton } from '@/ui';

/**
 * The quiet room every focus screen lives in: full height, no app chrome, a soft
 * background, one centered column. `tools` adds the small top-bar buttons (leave, sounds,
 * quick capture) used while a timer runs.
 */
export function FocusFrame({
  children,
  tools,
  className,
}: {
  children: ReactNode;
  tools?: ReactNode;
  className?: string;
}) {
  return (
    <main
      id="main"
      tabIndex={-1}
      className={cx(
        'relative flex min-h-dvh flex-col bg-[radial-gradient(ellipse_at_top,var(--ql-bg-glow-1),transparent_60%),radial-gradient(ellipse_at_bottom,var(--ql-bg-glow-2),transparent_55%)] outline-none',
        className,
      )}
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {tools && (
        <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-2 px-3 pt-3 sm:px-4">
          {tools}
        </div>
      )}
      <div
        className={cx(
          'mx-auto flex w-full max-w-xl flex-1 flex-col items-center px-4 pb-6 sm:px-6',
          tools ? 'pt-1' : 'justify-center pt-8',
        )}
      >
        {children}
      </div>
    </main>
  );
}

/** Top bar while a timer runs: leave focus mode (timer keeps going), sounds, quick capture. */
export function FocusTools({ onSounds }: { onSounds: () => void }) {
  const { t } = useTranslation('focus');
  const navigate = useNavigate();
  return (
    <>
      <IconButton
        icon="chevron-back"
        label={t('tools.leave')}
        onClick={() => navigate(PATHS.today)}
        className="text-muted"
      />
      <div className="flex items-center gap-1">
        <IconButton
          icon="music"
          label={t('tools.sounds')}
          onClick={onSounds}
          className="text-muted"
        />
        <QuickCaptureSlot />
      </div>
    </>
  );
}

/** The heading of a result screen; receives focus on mount so screen readers hear it. */
export function ViewHeading({
  children,
  headingRef,
  className,
}: {
  children: ReactNode;
  headingRef?: Ref<HTMLHeadingElement>;
  className?: string;
}) {
  return (
    <h1
      ref={headingRef}
      tabIndex={-1}
      className={cx(
        'text-center text-3xl font-semibold text-text outline-none sm:text-4xl',
        className,
      )}
    >
      {children}
    </h1>
  );
}

/** XP and gold earned, as small friendly chips. Nothing shown for zero. */
export function RewardChips({ xp, gold, label }: { xp: number; gold: number; label?: string }) {
  const { t } = useTranslation('focus');
  const { number } = useFormat();
  if (xp <= 0 && gold <= 0) return null;
  return (
    <span className="inline-flex flex-wrap items-center justify-center gap-1.5">
      {label && <span className="text-sm font-bold text-muted">{label}</span>}
      {xp > 0 && (
        <Chip tone="xp" icon="sparkle">
          {t('reward.xp', { value: number(xp) })}
        </Chip>
      )}
      {gold > 0 && (
        <Chip tone="gold" icon="coin">
          {t('reward.gold', { value: number(gold) })}
        </Chip>
      )}
    </span>
  );
}

/** Guess versus actual, side by side and neutral: data for next time, never a verdict. */
export function GuessVsActual({
  guessMinutes,
  actualMs,
  title,
}: {
  guessMinutes: number | null;
  actualMs: number;
  title: string;
}) {
  const { t } = useTranslation('focus');
  const { duration } = useFormat();
  return (
    <section
      aria-label={title}
      className="w-full rounded-lg border border-border bg-surface/80 p-4 shadow-sm"
    >
      <h2 className="mb-3 text-center text-sm font-bold text-muted">{title}</h2>
      <dl className="grid grid-cols-2 gap-3 text-center">
        <div className="min-w-0 rounded-md bg-surface-2 px-2 py-3">
          <dt className="text-sm text-muted">{t('estimate.guess')}</dt>
          <dd className="text-xl font-extrabold text-text" data-testid="estimate-guess">
            {guessMinutes !== null ? duration(guessMinutes * 60_000) : t('estimate.no_guess')}
          </dd>
        </div>
        <div className="min-w-0 rounded-md bg-surface-2 px-2 py-3">
          <dt className="text-sm text-muted">{t('estimate.actual')}</dt>
          <dd className="text-xl font-extrabold text-text" data-testid="estimate-actual">
            {duration(actualMs)}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-center text-sm text-muted">{t('estimate.note')}</p>
    </section>
  );
}
