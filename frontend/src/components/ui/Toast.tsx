import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useToastStore } from '@/components/ui/useToastStore';
import type { ToastVariant } from '@/components/ui/toast-types';

const toastStyles: Record<ToastVariant, { classes: string; Icon: typeof Info }> = {
  info: { classes: 'border-accent-200 bg-surface', Icon: Info },
  success: { classes: 'border-success-200 bg-surface', Icon: CheckCircle2 },
  warning: { classes: 'border-warning-200 bg-surface', Icon: TriangleAlert },
  danger: { classes: 'border-danger-200 bg-surface', Icon: AlertCircle },
};

const iconStyles: Record<ToastVariant, string> = {
  info: 'text-accent-600',
  success: 'text-success-600',
  warning: 'text-warning-600',
  danger: 'text-danger-600',
};

export function ToastViewport({ children }: { children?: ReactNode }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
    >
      {children}
    </div>
  );
}

export function Toasts() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  if (toasts.length === 0) return null;

  return (
    <ToastViewport>
      {toasts.map((toast) => {
        const { classes, Icon } = toastStyles[toast.variant];
        return (
          <div
            key={toast.id}
            role="status"
            className={cn(
              'animate-slide-up pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border p-4 shadow-lg',
              classes,
            )}
          >
            <Icon className={cn('mt-0.5 size-5 shrink-0', iconStyles[toast.variant])} aria-hidden="true" />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="type-label text-neutral-900">{toast.title}</p>
              {toast.description && <p className="type-body-sm text-neutral-500">{toast.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label={`Fechar notificação: ${toast.title}`}
              className="rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </ToastViewport>
  );
}
