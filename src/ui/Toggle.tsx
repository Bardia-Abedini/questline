import { useId, type ReactNode } from 'react';
import { cx } from './cx';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
  id?: string;
}

/** On/off switch with a visible label (role="switch"). */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
  className,
  id,
}: ToggleProps) {
  const auto = useId();
  const controlId = id ?? auto;
  const descId = description ? `${controlId}-desc` : undefined;
  return (
    <div className={cx('flex items-center justify-between gap-4', className)}>
      <div className="min-w-0">
        <label htmlFor={controlId} className="block font-bold text-text">
          {label}
        </label>
        {description && (
          <p id={descId} className="text-sm text-muted">
            {description}
          </p>
        )}
      </div>
      <button
        id={controlId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={descId}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border-2 transition-colors duration-200 ease-cozy',
          checked ? 'border-accent bg-accent' : 'border-border-strong bg-surface-3',
          'disabled:opacity-55',
        )}
      >
        <span
          aria-hidden
          className={cx(
            'absolute top-0.5 size-6 rounded-full bg-surface shadow-md transition-[inset-inline-start] duration-200 ease-cozy',
            checked ? 'start-[calc(100%-1.625rem)]' : 'start-0.5',
          )}
        />
      </button>
    </div>
  );
}
