import { useEffect, useId, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/**
 * Accessible dialog: focus moves to the panel, Escape closes,
 * body scroll is locked while open. Rendered inline (no portal
 * dependency) so it works in any React tree.
 */
export function Modal({ open, onClose, title, description, children, actions, className }: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Fechar diálogo"
        onClick={onClose}
        className="animate-fade-in absolute inset-0 cursor-default bg-neutral-950/50"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          'animate-scale-in relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-xl',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 p-5 sm:p-6">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 id={titleId} className="type-h3 text-neutral-900">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="type-body text-neutral-500">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-5 sm:px-6 sm:pb-6">{children}</div>
        {actions && (
          <div className="flex flex-col-reverse gap-2 border-t border-border bg-neutral-50 p-5 sm:flex-row sm:justify-end sm:p-6">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
