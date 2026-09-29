import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  label?: string;
  className?: string;
}

/** Controlled tabs with tablist semantics and arrow-key navigation. */
export function Tabs({ tabs, activeId, onChange, label = 'Abas', className }: TabsProps) {
  const listId = useId();

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const enabled = tabs
      .map((tab, tabIndex) => ({ tab, tabIndex }))
      .filter(({ tab }) => !tab.disabled);
    if (enabled.length === 0) return;
    const current = enabled.findIndex(({ tab }) => tab.id === activeId);
    const next = enabled[(current + direction + enabled.length) % enabled.length];
    if (next) {
      onChange(next.tab.id);
      document.getElementById(`${listId}-${next.tab.id}`)?.focus();
    }
    void index;
  };

  return (
    <div
      id={listId}
      role="tablist"
      aria-label={label}
      className={cn('flex w-full gap-1 overflow-x-auto rounded-xl bg-neutral-100 p-1', className)}
    >
      {tabs.map((tab, index) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            id={`${listId}-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={tab.disabled}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              'inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors duration-150',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500',
              'disabled:cursor-not-allowed disabled:opacity-50',
              active ? 'bg-surface text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-800',
            )}
          >
            {tab.icon && (
              <span className="flex size-4 items-center justify-center" aria-hidden="true">
                {tab.icon}
              </span>
            )}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
