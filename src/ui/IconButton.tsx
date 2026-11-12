import type { ButtonHTMLAttributes, Ref } from 'react';
import { buttonVariants, type ButtonVariant } from './buttonStyles';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: IconName;
  /** Accessible name (required: the button has no visible text). Also used as tooltip. */
  label: string;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  /** Fill the icon (e.g. a selected star). */
  filled?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

const SIZES = {
  sm: 'size-9 text-base',
  md: 'size-11 text-lg',
  lg: 'size-14 text-2xl',
};

export function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 'md',
  filled,
  className,
  type = 'button',
  ref,
  ...rest
}: IconButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full transition-[background-color,transform] duration-150 ease-cozy',
        'disabled:cursor-not-allowed disabled:opacity-55',
        buttonVariants[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      <Icon name={icon} filled={filled} />
    </button>
  );
}
