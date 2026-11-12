import { cx } from './cx';

/** Shared look of text inputs, textareas and selects. */
export const controlClass = cx(
  'w-full min-h-11 rounded-md border border-border-strong bg-surface px-3.5 py-2 text-base text-text',
  'placeholder:text-faint shadow-[inset_0_1px_2px_rgb(0_0_0/0.04)]',
  'transition-[border-color,box-shadow] duration-150',
  'hover:border-primary/60 focus-visible:outline-none focus-visible:border-focus focus-visible:ring-3 focus-visible:ring-focus/30',
  'aria-[invalid=true]:border-danger disabled:opacity-60 disabled:cursor-not-allowed',
);
