import type { ReactNode } from 'react';
import { create } from 'zustand';
import type { IconName } from './icons';

export type ToastTone = 'neutral' | 'success' | 'xp' | 'gold' | 'info' | 'warning';

export interface ToastOptions {
  title: ReactNode;
  description?: ReactNode;
  tone?: ToastTone;
  icon?: IconName;
  /** Milliseconds before it hides. 0 keeps it until dismissed. Default 4000. */
  duration?: number;
  /** One button, e.g. Undo or Reload. */
  action?: { label: string; onClick: () => void };
}

export interface ToastItem extends ToastOptions {
  id: number;
}

interface ToastStore {
  toasts: ToastItem[];
  show: (t: ToastOptions) => number;
  dismiss: (id: number) => void;
}

let nextId = 1;
const MAX_VISIBLE = 3;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  show: (t) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { ...t, id }].slice(-MAX_VISIBLE) }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

/** Shows a toast from anywhere (components, event listeners). Returns its id. */
export function showToast(options: ToastOptions): number {
  return useToastStore.getState().show(options);
}

export function dismissToast(id: number): void {
  useToastStore.getState().dismiss(id);
}
