import type { InputHTMLAttributes, ReactNode, Ref } from 'react';
import { cx } from './cx';
import { Field } from './Field';
import { controlClass } from './fieldStyles';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: ReactNode;
  hideLabel?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  id?: string;
  /** Classes for the wrapper (label + control). */
  wrapperClassName?: string;
  ref?: Ref<HTMLInputElement>;
}

export function Input({
  label,
  hideLabel,
  hint,
  error,
  id,
  wrapperClassName,
  className,
  ref,
  ...rest
}: InputProps) {
  return (
    <Field
      label={label}
      hideLabel={hideLabel}
      hint={hint}
      error={error}
      id={id}
      className={wrapperClassName}
    >
      {(field) => <input ref={ref} className={cx(controlClass, className)} {...field} {...rest} />}
    </Field>
  );
}
