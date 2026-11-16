import { useId, useRef, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ENERGY_LEVELS, type EnergyLevel } from '@/domain/types';
import { cx, Icon, isRtl, type IconName } from '@/ui';
import { checkInEnergy, useCurrentEnergy } from './energy';

const ICONS: Record<EnergyLevel, IconName> = { low: 'leaf', medium: 'sun', high: 'bolt' };

/**
 * One-tap energy check on the Today board: a small radio group. Nothing is selected until
 * the player taps; the choice counts for a few hours, then quietly asks again.
 */
export function EnergyCheck() {
  const { t } = useTranslation('insights');
  const energy = useCurrentEnergy();
  const labelId = useId();
  const hintId = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  if (energy === undefined) return null;

  const choose = (level: EnergyLevel) => void checkInEnergy(level);
  const current = energy ? ENERGY_LEVELS.indexOf(energy) : -1;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const rtl = isRtl(e.currentTarget);
    const from = current < 0 ? 0 : current;
    let next: number;
    if (e.key === 'ArrowRight') next = from + (rtl ? -1 : 1);
    else if (e.key === 'ArrowLeft') next = from + (rtl ? 1 : -1);
    else if (e.key === 'ArrowDown') next = from + 1;
    else if (e.key === 'ArrowUp') next = from - 1;
    else return;
    e.preventDefault();
    next = (next + ENERGY_LEVELS.length) % ENERGY_LEVELS.length;
    choose(ENERGY_LEVELS[next]!);
    refs.current[next]?.focus();
  };

  return (
    <section
      aria-labelledby={labelId}
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-surface/70 px-4 py-3"
      data-testid="energy-check"
    >
      <div className="min-w-0 flex-1 basis-40">
        <h2 id={labelId} className="flex items-center gap-2 font-bold text-text">
          <Icon name="battery" className="shrink-0 text-accent" />
          {energy ? t('energy.label_set') : t('energy.label')}
        </h2>
        <p id={hintId} className="text-sm text-muted" aria-live="polite">
          {energy ? t(`energy.hint_${energy}`) : t('energy.change_hint')}
        </p>
      </div>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={hintId}
        onKeyDown={onKeyDown}
        className="flex flex-wrap gap-1.5"
      >
        {ENERGY_LEVELS.map((level, i) => {
          const selected = energy === level;
          return (
            <button
              key={level}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected || (current < 0 && i === 0) ? 0 : -1}
              onClick={() => choose(level)}
              className={cx(
                'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-bold transition-colors duration-150',
                selected
                  ? 'border-accent bg-accent-soft text-text shadow-sm'
                  : 'border-border bg-surface text-muted hover:text-text',
              )}
            >
              <Icon name={ICONS[level]} filled={selected} />
              {t(`energy.${level}`)}
              {selected && <Icon name="check" size="1em" className="text-accent" />}
            </button>
          );
        })}
      </div>
    </section>
  );
}
