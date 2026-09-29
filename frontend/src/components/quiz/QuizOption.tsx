import { Check, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export type QuizOptionState = 'default' | 'selected' | 'correct' | 'incorrect' | 'disabled';

export interface QuizOptionProps {
  label: string;
  text: string;
  state?: QuizOptionState;
  selected?: boolean;
  disabled?: boolean;
  icon?: LucideIcon;
  onSelect?: () => void;
  className?: string;
}

const stateClasses: Record<QuizOptionState, string> = {
  default: 'border-border bg-surface hover:border-primary-300 hover:bg-primary-50/50',
  selected: 'border-primary-600 bg-primary-50 ring-2 ring-primary-600/20',
  correct: 'border-success-600 bg-success-50 ring-2 ring-success-600/20',
  incorrect: 'border-danger-500 bg-danger-50 ring-2 ring-danger-500/20',
  disabled: 'border-border bg-neutral-100 opacity-60',
};

/**
 * Visual answer option. High-contrast states for fast reading during play.
 * Purely presentational — no game rules here.
 */
export function QuizOption({
  label,
  text,
  state = 'default',
  selected = false,
  disabled = false,
  icon: Icon,
  onSelect,
  className,
}: QuizOptionProps) {
  const effectiveState: QuizOptionState = disabled ? 'disabled' : state;
  const pressed = selected || state === 'selected';

  return (
    <button
      type="button"
      disabled={disabled || effectiveState === 'disabled'}
      aria-pressed={pressed}
      onClick={onSelect}
      className={cn(
        'flex w-full min-h-14 items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500',
        'disabled:cursor-not-allowed',
        stateClasses[effectiveState],
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold',
          effectiveState === 'correct' && 'bg-success-600 text-white',
          effectiveState === 'incorrect' && 'bg-danger-600 text-white',
          effectiveState === 'selected' && 'bg-primary-600 text-white',
          effectiveState === 'default' && 'bg-neutral-100 text-neutral-600',
          effectiveState === 'disabled' && 'bg-neutral-200 text-neutral-400',
        )}
      >
        {effectiveState === 'correct' ? (
          <Check className="size-4" strokeWidth={3} />
        ) : effectiveState === 'incorrect' ? (
          <X className="size-4" strokeWidth={3} />
        ) : Icon ? (
          <Icon className="size-4" />
        ) : (
          label
        )}
      </span>
      <span className="type-body min-w-0 flex-1 font-medium break-words text-neutral-900">{text}</span>
    </button>
  );
}
