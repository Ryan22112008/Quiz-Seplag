import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface DropdownItem {
  id: string;
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}

export type DropdownEntry = DropdownItem | { id: string; separator: true };

export interface DropdownProps {
  trigger: ReactNode;
  items: DropdownEntry[];
  label?: string;
  align?: 'left' | 'right';
  className?: string;
}

function isSeparator(entry: DropdownEntry): entry is { id: string; separator: true } {
  return 'separator' in entry;
}

/** Lightweight menu without external dependencies. Keyboard: Esc closes. */
export function Dropdown({ trigger, items, label, align = 'left', className }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open ]);

  return (
    <div ref={rootRef} className={cn('relative inline-block', className)}>
      <div onClick={() => setOpen((value) => !value)} aria-haspopup="menu" aria-expanded={open}>
        {trigger}
      </div>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label ?? 'Menu'}
          className={cn(
            'animate-scale-in absolute z-40 mt-2 min-w-52 overflow-hidden rounded-xl border border-border bg-surface p-1.5 shadow-lg',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((entry) =>
            isSeparator(entry) ? (
              <div key={entry.id} role="separator" className="mx-2 my-1.5 h-px bg-neutral-200" />
            ) : (
              <button
                key={entry.id}
                type="button"
                role="menuitem"
                disabled={entry.disabled}
                onClick={() => {
                  entry.onSelect?.();
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-100',
                  'focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary-500',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  entry.danger
                    ? 'text-danger-700 hover:bg-danger-50 active:bg-danger-100'
                    : 'text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200',
                )}
              >
                {entry.icon && (
                  <span className="flex size-4 shrink-0 items-center justify-center" aria-hidden="true">
                    {entry.icon}
                  </span>
                )}
                <span className="truncate">{entry.label}</span>
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
