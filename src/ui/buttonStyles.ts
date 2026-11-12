import { cx } from './cx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'soft' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-on-primary shadow-md hover:bg-primary-hover active:translate-y-px disabled:shadow-none',
  secondary:
    'bg-surface text-text border border-border-strong shadow-sm hover:bg-surface-2 active:translate-y-px',
  soft: 'bg-primary-soft text-text hover:brightness-[0.97] active:translate-y-px',
  ghost: 'bg-transparent text-text hover:bg-surface-2',
  danger: 'bg-danger-soft text-danger hover:brightness-[0.97] active:translate-y-px',
};

export const buttonSizes: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3.5 text-sm gap-1.5 rounded-md',
  md: 'min-h-11 px-5 text-base gap-2 rounded-lg',
  lg: 'min-h-14 px-7 text-lg gap-2.5 rounded-xl',
};

/** Button look for things that are not <button>, e.g. a router <Link>. */
export function buttonClass(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  extra?: string,
): string {
  return cx(
    'inline-flex items-center justify-center font-bold',
    buttonVariants[variant],
    buttonSizes[size],
    extra,
  );
}
