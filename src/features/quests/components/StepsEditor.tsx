import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormat } from '@/i18n/useFormat';
import { Button, controlClass, cx, Icon, IconButton } from '@/ui';
import {
  addStep,
  makeStep,
  moveStep,
  removeStep,
  toggleStepQuick,
  updateStepGuess,
  updateStepTitle,
  type StepDraft,
} from '../model/draft';
import { QuestIcon } from './QuestIcon';

function focusById(id: string) {
  requestAnimationFrame(() => document.getElementById(id)?.focus());
}

/**
 * Add, edit, reorder and delete steps. Typing a step and pressing Enter adds it and keeps
 * the cursor in the "add" field, so a list can be typed in one go.
 */
export function StepsEditor({
  steps,
  onChange,
  idPrefix,
}: {
  steps: StepDraft[];
  onChange: (steps: StepDraft[]) => void;
  idPrefix: string;
}) {
  const { t } = useTranslation('quests');
  const { number } = useFormat();
  const [newTitle, setNewTitle] = useState('');
  const [newGuess, setNewGuess] = useState('');
  const addRef = useRef<HTMLInputElement>(null);
  const addId = `${idPrefix}-add`;

  const add = () => {
    if (!newTitle.trim()) {
      addRef.current?.focus();
      return;
    }
    const blank = makeStep(newTitle.trim());
    const step = newGuess.trim() ? updateStepGuess([blank], blank.key, newGuess)[0]! : blank;
    onChange(addStep(steps, step));
    setNewTitle('');
    setNewGuess('');
    addRef.current?.focus();
  };

  return (
    <div className="flex flex-col gap-2">
      {steps.length > 0 && (
        <ol className="flex flex-col gap-2">
          {steps.map((step, i) => {
            const n = number(i + 1);
            const base = `${idPrefix}-${step.key}`;
            return (
              <li
                key={step.key}
                className={cx(
                  'flex flex-col gap-2 rounded-lg border p-2.5',
                  step.done ? 'border-transparent bg-surface-2' : 'border-border bg-surface',
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={cx(
                      'grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold',
                      step.done ? 'bg-success-soft text-success' : 'bg-surface-2 text-muted',
                    )}
                  >
                    {step.done ? <Icon name="check" size="1em" /> : n}
                  </span>
                  <label htmlFor={`${base}-title`} className="ql-visually-hidden">
                    {step.done ? t('form.step_done_label', { n }) : t('form.step_label', { n })}
                  </label>
                  <input
                    id={`${base}-title`}
                    value={step.title}
                    onChange={(e) => onChange(updateStepTitle(steps, step.key, e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        focusById(addId);
                      }
                    }}
                    className={cx(controlClass, 'min-h-10 min-w-0 flex-1 py-1.5')}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 ps-9">
                  <label className="inline-flex items-center gap-1.5 text-sm text-muted">
                    <span className="ql-visually-hidden">{t('form.step_guess_label', { n })}</span>
                    <Icon name="timer" size="1.05em" />
                    <input
                      inputMode="numeric"
                      value={step.guess}
                      placeholder="–"
                      onChange={(e) => onChange(updateStepGuess(steps, step.key, e.target.value))}
                      className={cx(controlClass, 'min-h-9 w-16 px-2 py-1 text-center')}
                    />
                    <span aria-hidden>{t('form.minutes_short')}</span>
                  </label>
                  <button
                    type="button"
                    aria-pressed={step.quick}
                    onClick={() => onChange(toggleStepQuick(steps, step.key))}
                    aria-label={t('form.step_quick_label', { n })}
                    title={t('form.quick_hint')}
                    className={cx(
                      'inline-flex min-h-9 items-center gap-1 rounded-full border px-2.5 text-sm font-bold',
                      step.quick
                        ? 'border-success/40 bg-success-soft text-success'
                        : 'border-border bg-surface text-muted',
                    )}
                  >
                    <Icon name="bolt" size="1em" filled={step.quick} />
                    {t('step.quick')}
                  </button>
                  <span className="ms-auto flex items-center">
                    <IconButton
                      id={`${base}-up`}
                      icon="chevron-down"
                      className="[&_svg]:rotate-180"
                      size="sm"
                      label={t('form.move_up', { n })}
                      disabled={i === 0}
                      onClick={() => {
                        onChange(moveStep(steps, step.key, -1));
                        focusById(i - 1 === 0 ? `${base}-down` : `${base}-up`);
                      }}
                    />
                    <IconButton
                      id={`${base}-down`}
                      icon="chevron-down"
                      size="sm"
                      label={t('form.move_down', { n })}
                      disabled={i === steps.length - 1}
                      onClick={() => {
                        onChange(moveStep(steps, step.key, 1));
                        focusById(i + 1 === steps.length - 1 ? `${base}-up` : `${base}-down`);
                      }}
                    />
                    <IconButton
                      icon="trash"
                      size="sm"
                      label={t('form.remove_step', { n })}
                      onClick={() => {
                        const prev = steps[i - 1] ?? steps[i + 1];
                        onChange(removeStep(steps, step.key));
                        focusById(prev ? `${idPrefix}-${prev.key}-title` : addId);
                      }}
                    />
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <div className="flex items-end gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <label htmlFor={addId} className="text-sm font-bold text-text">
            {steps.length ? t('form.add_another_step') : t('form.add_step')}
          </label>
          <input
            id={addId}
            ref={addRef}
            value={newTitle}
            placeholder={t('form.add_step_placeholder')}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
            enterKeyHint="enter"
            className={cx(controlClass, 'min-w-0')}
          />
        </div>
        <label className="flex w-20 shrink-0 flex-col gap-1.5">
          <span className="text-sm font-bold text-text">{t('form.minutes_short')}</span>
          <input
            inputMode="numeric"
            value={newGuess}
            aria-label={t('form.new_step_guess')}
            placeholder="–"
            onChange={(e) => setNewGuess(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
            className={cx(controlClass, 'px-2 text-center')}
          />
        </label>
        <Button
          variant="secondary"
          onClick={add}
          className="shrink-0 px-3.5"
          aria-label={t('form.add_step_button')}
        >
          <QuestIcon name="plus" />
          <span aria-hidden className="hidden sm:inline">
            {t('form.add')}
          </span>
        </Button>
      </div>
    </div>
  );
}
