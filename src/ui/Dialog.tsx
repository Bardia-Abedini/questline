import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { cx } from './cx';
import { IconButton } from './IconButton';

export interface DialogProps {
  open: boolean;
  /** Called on Escape, backdrop click (unless disabled) and the close button. */
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Action buttons, shown at the bottom. */
  footer?: ReactNode;
  /**
   * `modal`: centered card. `sheet`: slides up from the bottom on phones and is a
   * centered card on wider screens. Default `sheet`.
   */
  variant?: 'modal' | 'sheet';
  size?: 'sm' | 'md' | 'lg';
  /** Element to focus first. Defaults to the first focusable element in the body. */
  initialFocus?: RefObject<HTMLElement | null>;
  /** Hide the close (X) button. Escape still closes. */
  hideClose?: boolean;
  /** Keep open on backdrop click (for forms with unsaved input). */
  dismissOnBackdrop?: boolean;
  className?: string;
}

const FOCUSABLE =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('inert') && el.getAttribute('aria-hidden') !== 'true',
  );
}

let openCount = 0;

/**
 * Accessible modal dialog / bottom sheet: role="dialog", aria-modal, labelled by its
 * title, focus trapped inside, Escape closes, focus returns to the opener, background
 * scroll is locked and the rest of the app is marked inert.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  variant = 'sheet',
  size = 'md',
  initialFocus,
  hideClose = false,
  dismissOnBackdrop = true,
  className,
}: DialogProps) {
  const { t } = useTranslation('common');
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const appRoot = document.getElementById('root');
    openCount++;
    document.documentElement.style.overflow = 'hidden';
    appRoot?.setAttribute('inert', '');
    appRoot?.setAttribute('aria-hidden', 'true');

    const panel = panelRef.current;
    const target = initialFocus?.current ?? (panel ? (focusables(panel)[0] ?? panel) : null);
    target?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const items = focusables(panel);
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      openCount--;
      if (openCount === 0) {
        document.documentElement.style.overflow = '';
        appRoot?.removeAttribute('inert');
        appRoot?.removeAttribute('aria-hidden');
      }
      previouslyFocused?.focus?.();
    };
  }, [open, initialFocus]);

  if (!open) return null;

  const sheet = variant === 'sheet';
  const width = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' }[size];

  return createPortal(
    <div
      className={cx(
        'fixed inset-0 z-50 flex justify-center',
        sheet ? 'items-end sm:items-center sm:p-6' : 'items-center p-4 sm:p-6',
      )}
    >
      <div
        aria-hidden
        className="absolute inset-0 animate-fade-in bg-scrim backdrop-blur-[2px]"
        onClick={dismissOnBackdrop ? () => onCloseRef.current() : undefined}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cx(
          'relative flex max-h-[92dvh] w-full flex-col bg-surface text-text shadow-lg outline-none',
          sheet
            ? 'animate-sheet-in rounded-t-xl pb-[env(safe-area-inset-bottom)] sm:animate-rise-in sm:rounded-xl sm:pb-0'
            : 'animate-rise-in rounded-xl',
          width,
          className,
        )}
      >
        {sheet && (
          <div
            aria-hidden
            className="mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-border-strong sm:hidden"
          />
        )}
        <div className="flex items-start gap-3 px-5 pt-4 sm:px-6 sm:pt-6">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-xl font-semibold">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-muted">
                {description}
              </p>
            )}
          </div>
          {!hideClose && (
            <IconButton
              icon="close"
              label={t('close')}
              size="sm"
              onClick={() => onCloseRef.current()}
              className="-me-1.5"
            />
          )}
        </div>
        {children && (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">{children}</div>
        )}
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-4 sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Bottom sheet on phones, centered card on wider screens. */
export function Sheet(props: Omit<DialogProps, 'variant'>) {
  return <Dialog {...props} variant="sheet" />;
}

/** Centered modal card. */
export function Modal(props: Omit<DialogProps, 'variant'>) {
  return <Dialog {...props} variant="modal" />;
}
