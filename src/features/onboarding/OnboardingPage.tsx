import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { setPreferences, usePreferences } from '@/app/preferences/preferences';
import { focusPath, PATHS } from '@/app/routing';
import { AvatarSvg } from '@/art/avatar/AvatarSvg';
import { HAIR_SWATCHES, SKIN_SWATCHES } from '@/art/avatar/swatches';
import { useProfile, useQuest } from '@/data';
import { equipAvatar, setDisplayName } from '@/features/game/slots';
import { useFormat } from '@/i18n/useFormat';
import {
  Button,
  Card,
  cx,
  Icon,
  Input,
  ProgressBar,
  SegmentedControl,
  Spinner,
  ToggleChip,
} from '@/ui';
import {
  createFirstQuest,
  finishOnboarding,
  readProgress,
  saveProgress,
  START,
  STEPS,
  type OnboardingProgress,
} from './state';

/** Free starter hair styles (everything else is unlocked in the shop). */
const STARTER_HAIR = ['hair_short', 'hair_long'] as const;

/** The four welcome screens. Full screen; every screen can be skipped. */
export function OnboardingPage() {
  const { t } = useTranslation('onboarding');
  const f = useFormat();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const replay = params.get('replay') === '1';
  const profile = useProfile();
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    finishing.current = false;
    void readProgress().then((p) => setProgress(replay ? START : p));
  }, [replay]);

  // Move focus to the new screen's title so keyboard and screen-reader users follow along.
  const step = progress?.step ?? 0;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  if (!profile || !progress) {
    return (
      <main id="main" className="grid min-h-dvh place-items-center">
        <Spinner label={t('progress_label')} />
      </main>
    );
  }
  if (profile.onboarded_at && !replay && !finishing.current)
    return <Navigate to={PATHS.today} replace />;

  const go = (patch: Partial<OnboardingProgress>) => {
    const next = { ...progress, ...patch };
    setProgress(next);
    void saveProgress(next);
  };
  const next = () => go({ step: Math.min(STEPS.length - 1, progress.step + 1) });
  const done = async (to: string = PATHS.today) => {
    finishing.current = true;
    await finishOnboarding();
    navigate(to, { replace: true });
  };

  const total = STEPS.length;
  const name = STEPS[progress.step]!;
  const heading = (text: string) => (
    <h1
      ref={headingRef}
      tabIndex={-1}
      className="text-3xl font-semibold text-text outline-none sm:text-4xl"
    >
      {text}
    </h1>
  );

  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 py-6 sm:py-10"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ProgressBar
          value={progress.step + 1}
          max={total}
          size="sm"
          label={t('progress_label')}
          valueText={t('progress', { n: f.number(progress.step + 1), total: f.number(total) })}
          className="min-w-32 flex-1"
        >
          <span className="text-sm text-muted">
            {t('progress', { n: f.number(progress.step + 1), total: f.number(total) })}
          </span>
        </ProgressBar>
        <Button variant="ghost" onClick={() => void done()}>
          {t('skip_all')}
        </Button>
      </div>

      {name === 'welcome' && <WelcomeScreen heading={heading} onNext={next} />}
      {name === 'adventurer' && <AdventurerScreen heading={heading} onNext={next} />}
      {name === 'quest' && (
        <QuestScreen
          heading={heading}
          onSkip={next}
          onAdded={(questId, stepId) => go({ step: 3, questId, stepId })}
        />
      )}
      {name === 'session' && (
        <SessionScreen
          heading={heading}
          stepId={progress.stepId}
          questId={progress.questId}
          onStart={(stepId) => void done(focusPath({ stepId, minutes: 5 }))}
          onDone={() => void done()}
        />
      )}

      {progress.step > 0 && (
        <div>
          <Button
            variant="ghost"
            icon="chevron-back"
            onClick={() => go({ step: progress.step - 1 })}
          >
            {t('back')}
          </Button>
        </div>
      )}
    </main>
  );
}

/** Set while finishing, so the "already onboarded" redirect does not race the navigation. */
const finishing = { current: false };

type Heading = (text: string) => ReactNode;

function Actions({ children }: { children: ReactNode }) {
  return <div className="mt-2 flex flex-wrap items-center gap-2">{children}</div>;
}

function WelcomeScreen({ heading, onNext }: { heading: Heading; onNext: () => void }) {
  const { t } = useTranslation('onboarding');
  const language = usePreferences((s) => s.language);
  const points = [
    ['steps', 'leaf'],
    ['start', 'timer'],
    ['rewards', 'star'],
  ] as const;
  return (
    <section className="flex flex-col gap-5">
      <img src="/favicon.svg" alt="" width={72} height={72} className="rounded-xl shadow-md" />
      {heading(t('welcome.title'))}
      <p className="text-lg text-muted">{t('welcome.body')}</p>
      <ul className="flex flex-col gap-2">
        {points.map(([key, icon]) => (
          <li key={key} className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
              <Icon name={icon} />
            </span>
            <span className="min-w-0 pt-1.5 font-bold text-text">{t(`welcome.point_${key}`)}</span>
          </li>
        ))}
      </ul>
      <Card>
        <SegmentedControl
          label={t('welcome.language')}
          showLabel
          value={language}
          onChange={(lang) => void setPreferences({ language: lang })}
          options={[
            { value: 'en', label: <span lang="en">English</span> },
            { value: 'fa', label: <span lang="fa">فارسی</span> },
          ]}
        />
      </Card>
      <Actions>
        <Button size="lg" iconEnd="arrow-forward" onClick={onNext}>
          {t('welcome.next')}
        </Button>
      </Actions>
    </section>
  );
}

function Swatches({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ id: string; color: string; name: string }>;
  value: string | null;
  onChange: (id: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <span id={id} className="text-sm font-bold text-text">
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={id} className="flex flex-wrap gap-2">
        {options.map((o) => {
          const selected = o.id === value;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={o.name}
              title={o.name}
              onClick={() => onChange(o.id)}
              className={cx(
                'grid size-11 place-items-center rounded-full border-2 transition-shadow',
                selected ? 'border-text shadow-md' : 'border-border',
              )}
              style={{ backgroundColor: o.color }}
            >
              {selected && (
                <span className="grid size-5 place-items-center rounded-full bg-surface text-text">
                  <Icon name="check" size={14} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AdventurerScreen({ heading, onNext }: { heading: Heading; onNext: () => void }) {
  const { t } = useTranslation('onboarding');
  const { t: tg } = useTranslation('game');
  const profile = useProfile();
  const [name, setName] = useState(profile?.display_name ?? '');
  if (!profile) return null;
  const look = profile.avatar;

  const set = (slot: 'skin' | 'hair' | 'hair_color', id: string) =>
    equipAvatar(slot, id).catch((e: unknown) => console.warn('[onboarding] avatar', e));
  const item = (id: string) => tg(`items.${id}` as 'items.hair_short');

  return (
    <section className="flex flex-col gap-5">
      {heading(t('adventurer.title'))}
      <p className="text-muted">{t('adventurer.body')}</p>
      <Card className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        <div className="shrink-0 rounded-xl bg-primary-soft p-2">
          <AvatarSvg look={look} size={140} title={t('adventurer.preview')} />
        </div>
        <div className="flex w-full min-w-0 flex-col gap-4">
          <Input
            label={t('adventurer.name')}
            placeholder={t('adventurer.name_placeholder')}
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => void setDisplayName(name)}
          />
          <Swatches
            label={t('adventurer.skin')}
            value={look.skin}
            onChange={(skin) => void set('skin', skin)}
            options={Object.entries(SKIN_SWATCHES).map(([id, s]) => ({
              id,
              color: s.base,
              name: item(id),
            }))}
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-text">{t('adventurer.hair')}</span>
            <div className="flex flex-wrap gap-2">
              {STARTER_HAIR.map((id) => (
                <ToggleChip
                  key={id}
                  selected={look.hair === id}
                  onChange={() => void set('hair', id)}
                >
                  {item(id)}
                </ToggleChip>
              ))}
            </div>
          </div>
          <Swatches
            label={t('adventurer.hair_color')}
            value={look.hair_color}
            onChange={(hair_color) => void set('hair_color', hair_color)}
            options={Object.entries(HAIR_SWATCHES).map(([id, s]) => ({
              id,
              color: s.base,
              name: item(id),
            }))}
          />
        </div>
      </Card>
      <Actions>
        <Button
          size="lg"
          iconEnd="arrow-forward"
          onClick={() => {
            void setDisplayName(name);
            onNext();
          }}
        >
          {t('adventurer.next')}
        </Button>
        <Button variant="ghost" onClick={onNext}>
          {t('skip')}
        </Button>
      </Actions>
    </section>
  );
}

function QuestScreen({
  heading,
  onSkip,
  onAdded,
}: {
  heading: Heading;
  onSkip: () => void;
  onAdded: (questId: string, stepId: string | null) => void;
}) {
  const { t } = useTranslation('onboarding');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const examples = [t('quest.example_1'), t('quest.example_2'), t('quest.example_3')];

  const add = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      const { quest, steps } = await createFirstQuest(title);
      onAdded(quest.id, steps[0]?.id ?? null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex flex-col gap-5">
      {heading(t('quest.title'))}
      <p className="text-muted">{t('quest.body')}</p>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <Input
          ref={inputRef}
          label={t('quest.label')}
          placeholder={t('quest.placeholder')}
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-muted">{t('quest.examples')}</span>
          <div className="flex flex-wrap gap-2">
            {examples.map((ex) => (
              <ToggleChip
                key={ex}
                selected={title === ex}
                onChange={() => {
                  setTitle(ex);
                  inputRef.current?.focus();
                }}
              >
                {ex}
              </ToggleChip>
            ))}
          </div>
        </div>
        <Actions>
          <Button type="submit" size="lg" icon="plus" disabled={!title.trim()} loading={busy}>
            {t('quest.next')}
          </Button>
          <Button variant="ghost" onClick={onSkip}>
            {t('skip')}
          </Button>
        </Actions>
      </form>
    </section>
  );
}

function SessionScreen({
  heading,
  questId,
  stepId,
  onStart,
  onDone,
}: {
  heading: Heading;
  questId: string | null;
  stepId: string | null;
  onStart: (stepId: string) => void;
  onDone: () => void;
}) {
  const { t } = useTranslation('onboarding');
  const quest = useQuest(questId)?.title ?? null;
  const ready = !!stepId && !!quest;
  return (
    <section className="flex flex-col gap-5">
      {heading(t('session.title'))}
      <Card tone="highlight" className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface text-primary">
          <Icon name="timer" size={24} />
        </span>
        <p className="min-w-0 text-text">
          {ready ? t('session.body', { quest }) : t('session.body_none')}
        </p>
      </Card>
      <Actions>
        {ready ? (
          <>
            <Button size="lg" icon="play" onClick={() => onStart(stepId)}>
              {t('session.start')}
            </Button>
            <Button variant="ghost" onClick={onDone}>
              {t('session.later')}
            </Button>
          </>
        ) : (
          <Button size="lg" iconEnd="arrow-forward" onClick={onDone}>
            {t('session.done')}
          </Button>
        )}
      </Actions>
    </section>
  );
}
