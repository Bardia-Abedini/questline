import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { buttonSizes, buttonVariants, type ButtonSize, type ButtonVariant } from './buttonStyles';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';

export type { ButtonSize, ButtonVariant };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Icon before the label (start side, so it follows the reading direction). */
  icon?: IconName;
  /** Icon after the label. */
  iconEnd?: IconName;
  /** Shows a spinner and blocks clicks. */
  loading?: boolean;
  fullWidth?: boolean;
  ref?: Ref<HTMLButtonElement>;
  children?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconEnd,
  loading = false,
  fullWidth = false,
  disabled,
  className,
  children,
  type = 'button',
  ref,
  ...rest
}: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex select-none items-center justify-center font-bold',
        'transition-[background-color,transform,box-shadow,filter] duration-150 ease-cozy',
        'disabled:cursor-not-allowed disabled:opacity-55',
        buttonVariants[variant],
        buttonSizes[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden
          className="inline-block size-[1.1em] animate-spin rounded-full border-2 border-current border-e-transparent"
        />
      ) : (
        icon && <Icon name={icon} />
      )}
      {children}
      {iconEnd && !loading && <Icon name={iconEnd} />}
    </button>
  );
}
