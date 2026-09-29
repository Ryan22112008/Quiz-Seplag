import { Progress } from '@/components/ui/Progress';
import { cn } from '@/lib/cn';

export interface GameProgressProps {
  current: number;
  total: number;
  className?: string;
}

/** Question counter + bar. Display only, no game flow logic. */
export function GameProgress({ current, total, className }: GameProgressProps) {
  const safeTotal = Math.max(1, total);
  const safeCurrent = Math.min(Math.max(0, current), safeTotal);
  return (
    <div className={cn('flex w-full flex-col gap-2', className)}>
      <div className="flex items-center justify-between">
        <span className="type-caption font-semibold tracking-wide text-neutral-500 uppercase">
          Questão {safeCurrent} de {safeTotal}
        </span>
        <span className="type-caption font-semibold text-neutral-700 tabular-nums">
          {Math.round((safeCurrent / safeTotal) * 100)}%
        </span>
      </div>
      <Progress value={safeCurrent} max={safeTotal} label={`Questão ${safeCurrent} de ${safeTotal}`} />
    </div>
  );
}
