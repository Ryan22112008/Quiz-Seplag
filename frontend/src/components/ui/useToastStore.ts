import { create } from 'zustand';
import type { ToastItem, ToastVariant } from '@/components/ui/toast-types';

interface ToastState {
  toasts: ToastItem[];
  push: (toast: Omit<ToastItem, 'id'> & { id?: string }) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

let toastCounter = 0;
function nextToastId(): string {
  toastCounter += 1;
  return `toast-${Date.now().toString(36)}-${toastCounter}`;
}

/**
 * Minimal dependency-free toast store.
 * Usage: `useToastStore.getState().push({ variant: 'success', title: 'Salvo' })`
 * and render `<Toasts />` once near the app root.
 */
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = toast.id ?? nextToastId();
    set((state) => ({
      toasts: [...state.toasts.slice(-4), { ...toast, id }],
    }));
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

export type { ToastItem, ToastVariant };
