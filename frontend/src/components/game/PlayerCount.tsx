import { Users } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface PlayerCountProps {
  count: number;
  max?: number;
  label?: string;
  className?: string;
}

/** Live player counter readout — display only. */
export function PlayerCount({ count, max, label = 'Jogadores', className }: PlayerCountProps) {
  return (
    <span
      aria-label={max ? `${count} de ${max} ${label.toLowerCase()}` : `${count} ${label.toLowerCase()}`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white tabular-nums',
        className,
      )}
    >
      <Users className="size-4" aria-hidden="true" />
      {count}
      {max !== undefined && <span className="font-normal text-neutral-400">/ {max}</span>}
      <span className="sr-only">{label}</span>
    </span>
  );
}
