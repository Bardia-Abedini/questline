import type { ReactNode, Ref, TextareaHTMLAttributes } from 'react';
import { cx } from './cx';
import { Field } from './Field';
import { controlClass } from './fieldStyles';

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: ReactNode;
  hideLabel?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  id?: string;
  wrapperClassName?: string;
  ref?: Ref<HTMLTextAreaElement>;
}

export function Textarea({
  label,
  hideLabel,
  hint,
  error,
  id,
  wrapperClassName,
  className,
  rows = 3,
  ref,
  ...rest
}: TextareaProps) {
  return (
    <Field
      label={label}
      hideLabel={hideLabel}
      hint={hint}
      error={error}
      id={id}
      className={wrapperClassName}
    >
      {(field) => (
        <textarea
          ref={ref}
          rows={rows}
          className={cx(controlClass, 'resize-y py-2.5', className)}
          {...field}
          {...rest}
        />
      )}
    </Field>
  );
}
