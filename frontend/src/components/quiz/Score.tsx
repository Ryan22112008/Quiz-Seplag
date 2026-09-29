import { Trophy } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface ScoreProps {
  value: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  highlight?: boolean;
  className?: string;
}

const sizes = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-4xl',
} as const;

/** Readout for a player's score — display only, no scoring rules. */
export function Score({ value, label = 'Pontuação', size = 'md', highlight = false, className }: ScoreProps) {
  return (
    <div className={cn('flex flex-col items-center gap-0.5', className)}>
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
        <Trophy className="size-3.5 text-warning-500" aria-hidden="true" />
        {label}
      </span>
      <span
        aria-label={`${label}: ${value.toLocaleString('pt-BR')}`}
        className={cn(
          'font-display font-bold tabular-nums',
          sizes[size],
          highlight ? 'text-primary-700' : 'text-neutral-900',
        )}
      >
        {value.toLocaleString('pt-BR')}
      </span>
    </div>
  );
}
