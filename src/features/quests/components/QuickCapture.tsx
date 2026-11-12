import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, IconButton, Input, Sheet, showToast } from '@/ui';
import { quickCapture } from '../model/actions';

/** True when a key press should go to a text field (or a dialog), not to the `Q` shortcut. */
function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (el as HTMLInputElement).type;
    return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color'].includes(type);
  }
  return false;
}

export interface QuickCaptureProps {
  /** `icon`: round "+" (header). `button`: a labelled button (e.g. inside focus mode). */
  variant?: 'icon' | 'button';
  /** Listen for the `Q` shortcut. Default true. */
  shortcut?: boolean;
  className?: string;
}

/**
 * One line, straight into the Inbox (plan section 1). Self-contained: works in the shell
 * header and in focus mode with no shell around it.
 */
export function QuickCapture({ variant = 'icon', shortcut = true, className }: QuickCaptureProps) {
  const { t } = useTranslation('quests');
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!shortcut) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code !== 'KeyQ' && e.key.toLowerCase() !== 'q') return;
      if (isTypingTarget(e.target) || document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      setOpen(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [shortcut]);

  const close = () => {
    setOpen(false);
    setText('');
  };

  const save = async () => {
    const title = text.trim();
    if (!title || saving) {
      inputRef.current?.focus();
      return;
    }
    setSaving(true);
    try {
      await quickCapture(title);
      close();
      showToast({
        title: t('capture.saved'),
        description: title,
        tone: 'success',
        icon: 'inbox',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {variant === 'icon' ? (
        <IconButton
          icon="plus"
          variant="soft"
          size="sm"
          label={t('capture.open')}
          aria-keyshortcuts="q"
          onClick={() => setOpen(true)}
          className={className}
        />
      ) : (
        <Button
          variant="secondary"
          icon="plus"
          aria-keyshortcuts="q"
          onClick={() => setOpen(true)}
          className={className}
        >
          {t('capture.open')}
        </Button>
      )}
      <Sheet
        open={open}
        onClose={close}
        title={t('capture.title')}
        description={t('capture.body')}
        initialFocus={inputRef}
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              {t('actions.cancel')}
            </Button>
            <Button icon="inbox" loading={saving} onClick={save}>
              {t('capture.save')}
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <Input
            ref={inputRef}
            label={t('capture.label')}
            hideLabel
            placeholder={t('capture.placeholder')}
            value={text}
            autoComplete="off"
            enterKeyHint="done"
            onChange={(e) => setText(e.target.value)}
          />
        </form>
      </Sheet>
    </>
  );
}
