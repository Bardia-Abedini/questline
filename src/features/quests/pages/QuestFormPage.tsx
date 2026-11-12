import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { PATHS } from '@/app/routing';
import { shouldSuggestSplittingFirstStep } from '@/domain/steps';
import { useAi, type AiStepSuggestion } from '@/features/cloud/slots';
import { useSettings, useTemplates, type Uuid } from '@/data';
import { useFormat } from '@/i18n/useFormat';
import {
  Button,
  Card,
  EmptyState,
  Icon,
  Input,
  Page,
  Section,
  Select,
  showToast,
  Spinner,
  Textarea,
  Toggle,
} from '@/ui';
import { useEstimateRatios, useStatusCounts } from '../hooks';
import {
  applyQuickClassification,
  createQuestFromDraft,
  draftFromQuest,
  draftFromTemplate,
  updateQuestFromDraft,
} from '../model/actions';
import {
  addStep,
  emptyDraft,
  firstStepGuess,
  isRecurrenceComplete,
  makeStep,
  parseMinutes,
  replaceStep,
  sumStepGuesses,
  type QuestDraft,
  type StepDraft,
} from '../model/draft';
import { useAiErrorToast } from '../components/aiErrors';
import {
  CategoryField,
  DifficultyField,
  DueFields,
  EstimateHint,
  PriorityField,
  RecurrenceFields,
  SuggestionNote,
  TagsField,
} from '../components/FormFields';
import { QuestIcon } from '../components/QuestIcon';
import { StepsEditor } from '../components/StepsEditor';

type MetaField = 'priority' | 'difficulty' | 'guess';

function toAiDrafts(steps: AiStepSuggestion[]): StepDraft[] {
  return steps.map((s) => makeStep(s.title, s.guessMinutes, s.quick, 'ai'));
}

/**
 * Add / edit quest (plan section 1). Only the title is required and one tap saves; the
 * rest is progressively disclosed. Routes: `quests/new` (`?from=today`, `?template=<id>`),
 * `quests/:questId/edit` (`?sort=1` turns an Inbox item into a real quest).
 */
export function QuestFormPage() {
  const { t } = useTranslation('quests');
  const format = useFormat();
  const navigate = useNavigate();
  const { questId } = useParams();
  const [params] = useSearchParams();
  const editing = !!questId;
  const sorting = editing && params.get('sort') === '1';
  const fromToday = params.get('from') === 'today';
  const templateId = params.get('template');
  const id = useId();

  const ai = useAi();
  const aiError = useAiErrorToast();
  const settings = useSettings();
  const counts = useStatusCounts();
  const templates = useTemplates();
  const ratios = useEstimateRatios();

  const [draft, setDraft] = useState<QuestDraft | null>(editing ? null : emptyDraft());
  const [missing, setMissing] = useState(false);
  const [showDetails, setShowDetails] = useState(editing);
  const [activateChoice, setActivateChoice] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [titleError, setTitleError] = useState(false);
  const [usedTemplate, setUsedTemplate] = useState<Uuid | null>(null);
  const [breaking, setBreaking] = useState(false);
  const [aiPlan, setAiPlan] = useState<{ previous: StepDraft[] } | null>(null);
  const [shrinking, setShrinking] = useState(false);
  const [touched, setTouched] = useState<Set<MetaField>>(new Set());
  const [suggestedFor, setSuggestedFor] = useState<string | null>(null);
  const [metaNote, setMetaNote] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  // Load the quest being edited.
  useEffect(() => {
    if (!questId) return;
    let live = true;
    void draftFromQuest(questId).then((d) => {
      if (!live) return;
      if (d) setDraft(d);
      else setMissing(true);
    });
    return () => {
      live = false;
    };
  }, [questId]);

  // New quest from a template link.
  // (Adjusting state while rendering, once the templates have loaded.)
  const [templateParamDone, setTemplateParamDone] = useState(false);
  if (!editing && templateId && templates && !templateParamDone) {
    setTemplateParamDone(true);
    const tpl = templates.find((x) => x.id === templateId);
    if (tpl) {
      setDraft((d) => draftFromTemplate(tpl, d ?? emptyDraft()));
      setUsedTemplate(tpl.id);
      setShowDetails(true);
    }
  }

  // Auto priority, difficulty and guess from AI, applied only to fields the player has not set.
  const title = draft?.title.trim() ?? '';
  useEffect(() => {
    if (!ai.available || (editing && !sorting)) return;
    if (title.length < 3 || suggestedFor === title) return;
    const handle = window.setTimeout(async () => {
      setSuggestedFor(title);
      try {
        const meta = await ai.suggestMeta({ title, notes: draft?.notes });
        setDraft((d) => {
          if (!d || d.title.trim() !== title) return d;
          return {
            ...d,
            priority: touched.has('priority') ? d.priority : meta.priority,
            difficulty: touched.has('difficulty') ? d.difficulty : meta.difficulty,
            guess: touched.has('guess') || d.guess ? d.guess : String(meta.guessMinutes),
          };
        });
        setMetaNote(true);
      } catch {
        // Suggestions are a bonus; the form works the same without them.
      }
    }, 900);
    return () => window.clearTimeout(handle);
  }, [ai, title, suggestedFor, editing, sorting, touched, draft?.notes]);

  if (missing)
    return (
      <Page title={t('form.edit_title')}>
        <EmptyState icon="search" title={t('detail.missing_title')}>
          {t('detail.missing_body')}
        </EmptyState>
      </Page>
    );
  if (!draft || !settings || !counts)
    return (
      <Page title={editing ? t('form.edit_title') : t('form.new_title')}>
        <Spinner label={t('loading')} />
      </Page>
    );

  const update = (patch: Partial<QuestDraft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const touch = (field: MetaField) => setTouched((s) => new Set(s).add(field));

  const room = counts.active < settings.active_limit;
  const offerActivate = !editing || sorting;
  const activate = activateChoice ?? (fromToday && room);

  const breakDown = async () => {
    if (!draft.title.trim()) {
      setTitleError(true);
      titleRef.current?.focus();
      return;
    }
    setBreaking(true);
    try {
      const steps = await ai.breakDown({ title: draft.title.trim(), notes: draft.notes });
      setAiPlan((p) => p ?? { previous: draft.steps });
      update({ steps: [...draft.steps.filter((s) => s.done), ...toAiDrafts(steps)] });
    } catch (error) {
      aiError(error);
    } finally {
      setBreaking(false);
    }
  };

  const first = firstStepGuess(draft.steps);
  const showFirstStepHint = first !== null && shouldSuggestSplittingFirstStep(first.minutes);

  const shrinkFirst = async () => {
    if (!first) return;
    const step = draft.steps.find((s) => s.key === first.key);
    if (!step) return;
    setShrinking(true);
    try {
      const parts = await ai.splitStep({
        questTitle: draft.title,
        stepTitle: step.title,
        guessMinutes: first.minutes,
      });
      setDraft((d) => (d ? { ...d, steps: replaceStep(d.steps, step.key, toAiDrafts(parts)) } : d));
    } catch (error) {
      aiError(error);
    } finally {
      setShrinking(false);
    }
  };

  const addTinyFirst = () => {
    const index = draft.steps.findIndex((s) => !s.done && s.title.trim());
    const step = makeStep('', 2);
    update({ steps: addStep(draft.steps, step, Math.max(0, index)) });
    requestAnimationFrame(() => document.getElementById(`${id}-steps-${step.key}-title`)?.focus());
  };

  const guessMinutes = parseMinutes(draft.guess);
  const stepSum = sumStepGuesses(draft.steps);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.title.trim()) {
      setTitleError(true);
      titleRef.current?.focus();
      return;
    }
    if (saving) return;
    setSaving(true);
    const toSave: QuestDraft = isRecurrenceComplete(draft.recurrence)
      ? draft
      : { ...draft, recurrence: { ...draft.recurrence, kind: 'none' } };
    try {
      const result = editing
        ? await updateQuestFromDraft(questId!, toSave, {
            sortFromInbox: sorting,
            activate: sorting && activate,
          })
        : await createQuestFromDraft(toSave, {
            activate,
            source: usedTemplate ? 'template' : 'manual',
            templateId: usedTemplate,
          });
      if (ai.available) {
        void applyQuickClassification(result.quest.id, (steps) =>
          ai.classifyQuick({ steps }),
        ).catch(() => undefined);
      }
      const where = result.activated ? t('toast.saved_active') : t('toast.saved_backlog');
      showToast({
        title:
          editing && !sorting
            ? t('toast.saved')
            : t('toast.saved_named', { title: result.quest.title }),
        description: editing && !sorting ? undefined : where,
        tone: 'success',
        icon: 'check',
      });
      if (sorting) navigate('/quests?tab=inbox', { replace: true });
      else if (fromToday && !editing) navigate(PATHS.today, { replace: true });
      else navigate(`/quests/${result.quest.id}`, { replace: true });
    } finally {
      setSaving(false);
    }
  };

  const pageTitle = sorting
    ? t('form.sort_title')
    : editing
      ? t('form.edit_title')
      : t('form.new_title');

  return (
    <Page title={pageTitle} subtitle={editing ? undefined : t('form.subtitle')}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        {!editing && templates && templates.length > 0 && (
          <Select
            id={`${id}-template`}
            label={t('form.from_template')}
            placeholder={t('form.no_template')}
            value={usedTemplate ?? ''}
            onChange={(e) => {
              const tpl = templates.find((x) => x.id === e.target.value);
              if (tpl) {
                setDraft(draftFromTemplate(tpl, draft));
                setUsedTemplate(tpl.id);
              } else setUsedTemplate(null);
            }}
            options={templates.map((x) => ({ value: x.id, label: x.title }))}
          />
        )}

        <Input
          ref={titleRef}
          id={`${id}-title`}
          label={t('form.title')}
          placeholder={t('form.title_placeholder')}
          value={draft.title}
          autoFocus={!editing}
          autoComplete="off"
          enterKeyHint="done"
          error={titleError && !draft.title.trim() ? t('form.title_needed') : undefined}
          onChange={(e) => {
            update({ title: e.target.value });
            if (e.target.value.trim()) setTitleError(false);
          }}
          className="text-lg font-bold"
        />

        <Section title={t('form.steps')} description={t('form.steps_hint')} className="gap-2">
          {ai.available && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="soft" icon="sparkle" loading={breaking} onClick={breakDown}>
                {draft.steps.some((s) => !s.done) && aiPlan
                  ? t('ai.try_again')
                  : t('ai.break_down')}
              </Button>
            </div>
          )}
          {aiPlan && (
            <Card tone="xp" padding="sm" className="flex flex-col gap-2" role="status">
              <p className="text-sm">{t('ai.plan_ready')}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  icon="close"
                  onClick={() => {
                    update({ steps: aiPlan.previous });
                    setAiPlan(null);
                  }}
                >
                  {t('ai.undo_plan')}
                </Button>
              </div>
            </Card>
          )}
          <StepsEditor
            steps={draft.steps}
            onChange={(steps) => update({ steps })}
            idPrefix={`${id}-steps`}
          />
          {showFirstStepHint && first && (
            <Card tone="sunken" padding="sm" className="flex flex-col gap-2" role="note">
              <p className="flex items-start gap-2 text-sm">
                <Icon name="feather" className="mt-0.5 shrink-0 text-primary" />
                <span>
                  {t('first_step.hint', {
                    minutes: format.duration(first.minutes * 60_000),
                  })}
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                {ai.available ? (
                  <Button
                    size="sm"
                    variant="soft"
                    icon="sparkle"
                    loading={shrinking}
                    onClick={shrinkFirst}
                  >
                    {t('first_step.shrink')}
                  </Button>
                ) : (
                  <Button size="sm" variant="soft" onClick={addTinyFirst}>
                    <QuestIcon name="plus" />
                    {t('first_step.add_tiny')}
                  </Button>
                )}
              </div>
            </Card>
          )}
        </Section>

        {metaNote && ai.available && <SuggestionNote>{t('ai.meta_note')}</SuggestionNote>}

        <div>
          <Button
            variant="ghost"
            aria-expanded={showDetails}
            aria-controls={`${id}-details`}
            onClick={() => setShowDetails((v) => !v)}
            className="-ms-3"
          >
            <Icon
              name="chevron-down"
              className={showDetails ? 'rotate-180 transition-transform' : 'transition-transform'}
            />
            {showDetails ? t('form.fewer_details') : t('form.more_details')}
          </Button>
        </div>

        <div id={`${id}-details`} hidden={!showDetails} className="flex flex-col gap-5">
          {showDetails && (
            <>
              <Textarea
                id={`${id}-notes`}
                label={t('form.notes')}
                value={draft.notes}
                onChange={(e) => update({ notes: e.target.value })}
                rows={3}
              />
              <PriorityField
                value={draft.priority}
                onChange={(priority) => {
                  touch('priority');
                  update({ priority });
                }}
              />
              <DifficultyField
                value={draft.difficulty}
                onChange={(difficulty) => {
                  touch('difficulty');
                  update({ difficulty });
                }}
              />
              <div className="flex flex-col gap-2">
                <Input
                  id={`${id}-guess`}
                  inputMode="numeric"
                  label={t('form.guess')}
                  value={draft.guess}
                  placeholder={stepSum ? format.number(stepSum) : undefined}
                  onChange={(e) => {
                    touch('guess');
                    update({ guess: e.target.value });
                  }}
                  hint={
                    stepSum
                      ? t('form.guess_steps_sum', {
                          minutes: format.duration(stepSum * 60_000),
                        })
                      : t('form.guess_hint')
                  }
                  className="max-w-36"
                />
                <EstimateHint
                  guessMinutes={guessMinutes ?? stepSum}
                  categoryId={draft.categoryId}
                  ratios={ratios}
                  onUse={(m) => {
                    touch('guess');
                    update({ guess: String(m) });
                  }}
                />
              </div>
              <DueFields
                idPrefix={id}
                date={draft.dueDate}
                time={draft.dueTime}
                onChange={(dueDate, dueTime) => update({ dueDate, dueTime })}
              />
              <CategoryField
                value={draft.categoryId}
                onChange={(categoryId) => update({ categoryId })}
              />
              <TagsField
                idPrefix={id}
                value={draft.tagIds}
                onChange={(tagIds) => update({ tagIds })}
              />
              <RecurrenceFields
                idPrefix={id}
                value={draft.recurrence}
                onChange={(recurrence) => update({ recurrence })}
                weekStartsOn={settings.week_starts_on}
              />
            </>
          )}
        </div>

        {offerActivate && (
          <Card tone="sunken" padding="sm">
            <Toggle
              label={t('form.activate')}
              description={
                room
                  ? t('form.activate_hint', {
                      active: format.number(counts.active),
                      limit: format.number(settings.active_limit),
                    })
                  : t('form.activate_full', { limit: format.number(settings.active_limit) })
              }
              checked={activate && room}
              disabled={!room}
              onChange={setActivateChoice}
            />
          </Card>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="lg" icon="check" loading={saving} className="min-w-40">
            {sorting ? t('form.save_sorted') : t('form.save')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
              if (idx > 0) navigate(-1);
              else
                navigate(editing ? `/quests/${questId}` : fromToday ? PATHS.today : PATHS.quests);
            }}
          >
            {t('actions.cancel')}
          </Button>
        </div>
      </form>
    </Page>
  );
}
