import { useId, type ReactNode } from 'react';
import { cx } from './cx';

export interface FieldRenderProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
}

export interface FieldProps {
  label: ReactNode;
  /** Visually hide the label (it is still read by screen readers). */
  hideLabel?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  id?: string;
  className?: string;
  children: (props: FieldRenderProps) => ReactNode;
}

/** Label + control + hint/error, wired with ids for screen readers. */
export function Field({ label, hideLabel, hint, error, id, className, children }: FieldProps) {
  const auto = useId();
  const controlId = id ?? auto;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label
        htmlFor={controlId}
        className={cx('text-sm font-bold text-text', hideLabel && 'ql-visually-hidden')}
      >
        {label}
      </label>
      {children({
        id: controlId,
        'aria-describedby': describedBy,
        ...(error ? { 'aria-invalid': true as const } : {}),
      })}
      {hint && !error && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
