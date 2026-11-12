/**
 * Public components of the Quests package, mounted by the app shell, the Today board and
 * (for quick capture) focus mode. OWNER: Quests.
 */
import { ActiveBoard } from './components/ActiveBoard';
import { OverduePrompt } from './components/OverduePrompt';
import { QuickCapture, type QuickCaptureProps } from './components/QuickCapture';

/**
 * Global "+" quick capture button and the `Q` shortcut (plan section 1). Rendered in the
 * shell header, and by Focus inside focus mode (`variant="button"` gives a labelled button).
 * Works with no shell around it.
 */
export function QuickCaptureSlot(props: QuickCaptureProps) {
  return <QuickCapture {...props} />;
}

/** The single "Can this still be done?" prompt for overdue quests (plan section 9). Rendered once in the shell. */
export function OverduePromptSlot() {
  return <OverduePrompt />;
}

/** Active Quests with the big Continue button, for the Today board (plan section 2). */
export function ActiveQuestsSlot() {
  return <ActiveBoard />;
}

export type { QuickCaptureProps };
