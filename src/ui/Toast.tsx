import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';
import { useToastStore, type ToastItem, type ToastTone } from './toastStore';

const TONES: Record<ToastTone, { box: string; icon: IconName; iconColor: string }> = {
  neutral: { box: 'border-border', icon: 'info', iconColor: 'text-muted' },
  success: { box: 'border-success/40', icon: 'check', iconColor: 'text-success' },
  xp: { box: 'border-xp/40', icon: 'sparkle', iconColor: 'text-xp' },
  gold: { box: 'border-gold/40', icon: 'coin', iconColor: 'text-gold' },
  info: { box: 'border-info/40', icon: 'info', iconColor: 'text-info' },
  warning: { box: 'border-warning/40', icon: 'alert', iconColor: 'text-warning' },
};

function ToastCard({ toast }: { toast: ToastItem }) {
  const { t } = useTranslation('common');
  const dismiss = useToastStore((s) => s.dismiss);
  const tone = TONES[toast.tone ?? 'neutral'];
  const duration = toast.duration ?? 4000;

  useEffect(() => {
    if (duration <= 0) return;
    const timer = window.setTimeout(() => dismiss(toast.id), duration);
    return () => window.clearTimeout(timer);
  }, [duration, dismiss, toast.id]);

  return (
    <div
      role="status"
      className={cx(
        'pointer-events-auto flex w-full animate-rise-in items-start gap-3 rounded-lg border-2 bg-surface p-3.5 text-text shadow-lg',
        tone.box,
      )}
    >
      <span className={cx('mt-0.5', tone.iconColor)}>
        <Icon name={toast.icon ?? tone.icon} size={22} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold">{toast.title}</p>
        {toast.description && <p className="text-sm text-muted">{toast.description}</p>}
      </div>
      {toast.action && (
        <button
          type="button"
          className="shrink-0 rounded-md px-2 py-1 font-bold text-primary hover:bg-surface-2"
          onClick={() => {
            toast.action!.onClick();
            dismiss(toast.id);
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        aria-label={t('dismiss')}
        className="-m-1 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-2"
        onClick={() => dismiss(toast.id)}
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}

/**
 * Renders toasts. Mount once (the app shell does). Sits above the phone tab bar and
 * announces politely to screen readers.
 */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  return createPortal(
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--ql-tabbar-h)+env(safe-area-inset-bottom)+0.75rem)] z-[60] mx-auto flex w-full max-w-md flex-col gap-2 px-4 md:bottom-6"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} />
      ))}
    </div>,
    document.body,
  );
}
