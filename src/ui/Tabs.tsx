import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from './cx';
import { isRtl } from './direction';
import { Icon, type IconName } from './Icon';

export interface TabItem<V extends string> {
  value: V;
  label: ReactNode;
  icon?: IconName;
  /** Small count next to the label (e.g. Inbox 3). */
  badge?: ReactNode;
  content: ReactNode;
}

export interface TabsProps<V extends string> {
  /** Accessible name of the tab list. */
  label: string;
  items: readonly TabItem<V>[];
  /** Controlled value. */
  value?: V;
  defaultValue?: V;
  onChange?: (value: V) => void;
  className?: string;
  /** Classes for the panel wrapper. */
  panelClassName?: string;
}

/**
 * WAI-ARIA tabs with automatic activation. Arrow keys follow the reading direction,
 * Home/End jump to the ends. Only the active panel is rendered.
 */
export function Tabs<V extends string>({
  label,
  items,
  value,
  defaultValue,
  onChange,
  className,
  panelClassName,
}: TabsProps<V>) {
  const base = useId();
  const [inner, setInner] = useState<V | undefined>(defaultValue ?? items[0]?.value);
  const active = value ?? inner;
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const select = (v: V) => {
    if (value === undefined) setInner(v);
    onChange?.(v);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const rtl = isRtl(e.currentTarget);
    const index = items.findIndex((i) => i.value === active);
    let next: number;
    if (e.key === 'ArrowRight') next = index + (rtl ? -1 : 1);
    else if (e.key === 'ArrowLeft') next = index + (rtl ? 1 : -1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    else return;
    e.preventDefault();
    next = (next + items.length) % items.length;
    select(items[next]!.value);
    refs.current[next]?.focus();
  };

  const activeItem = items.find((i) => i.value === active);

  return (
    <div className={cx('flex flex-col gap-4', className)}>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex max-w-full gap-1 overflow-x-auto border-b border-border [scrollbar-width:none]"
      >
        {items.map((item, i) => {
          const selected = item.value === active;
          return (
            <button
              key={item.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${item.value}`}
              aria-selected={selected}
              aria-controls={`${base}-panel-${item.value}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(item.value)}
              className={cx(
                'relative -mb-px inline-flex min-h-11 shrink-0 items-center gap-2 border-b-[3px] px-3.5 font-bold transition-colors duration-150',
                selected
                  ? 'border-primary text-text'
                  : 'border-transparent text-muted hover:text-text',
              )}
            >
              {item.icon && <Icon name={item.icon} />}
              {item.label}
              {item.badge !== undefined && (
                <span className="rounded-full bg-surface-3 px-2 text-xs leading-5 text-text">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {activeItem && (
        <div
          role="tabpanel"
          id={`${base}-panel-${activeItem.value}`}
          aria-labelledby={`${base}-tab-${activeItem.value}`}
          tabIndex={0}
          className={cx('focus-visible:outline-offset-4', panelClassName)}
        >
          {activeItem.content}
        </div>
      )}
    </div>
  );
}
