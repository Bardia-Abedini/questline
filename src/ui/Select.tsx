import type { ReactNode, Ref, SelectHTMLAttributes } from 'react';
import { cx } from './cx';
import { Field } from './Field';
import { controlClass } from './fieldStyles';
import { Icon } from './Icon';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'id' | 'children'
> {
  label: ReactNode;
  options: readonly SelectOption[];
  hideLabel?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  id?: string;
  /** Shown as a first, empty choice. */
  placeholder?: string;
  wrapperClassName?: string;
  ref?: Ref<HTMLSelectElement>;
}

/** Native select (best on phones and for screen readers), styled to match. */
export function Select({
  label,
  options,
  hideLabel,
  hint,
  error,
  id,
  placeholder,
  wrapperClassName,
  className,
  ref,
  ...rest
}: SelectProps) {
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
        <div className="relative">
          <select
            ref={ref}
            className={cx(controlClass, 'appearance-none pe-10', className)}
            {...field}
            {...rest}
          >
            {placeholder !== undefined && <option value="">{placeholder}</option>}
            {options.map((o) => (
              <option key={o.value} value={o.value} disabled={o.disabled}>
                {o.label}
              </option>
            ))}
          </select>
          <Icon
            name="chevron-down"
            className="pointer-events-none absolute inset-y-0 end-3 my-auto text-muted"
          />
        </div>
      )}
    </Field>
  );
}
