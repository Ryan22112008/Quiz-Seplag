import { cn } from '@/lib/cn';

export type ProgressTone = 'primary' | 'success' | 'warning' | 'danger' | 'accent';

export interface ProgressProps {
  value: number;
  max?: number;
  tone?: ProgressTone;
  showLabel?: boolean;
  label?: string;
  className?: string;
}

const tones: Record<ProgressTone, string> = {
  primary: 'bg-primary-600',
  success: 'bg-success-600',
  warning: 'bg-warning-500',
  danger: 'bg-danger-600',
  accent: 'bg-accent-500',
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Determinate progress bar with native progress semantics. */
export function Progress({ value, max = 100, tone = 'primary', showLabel = false, label, className }: ProgressProps) {
  const safeMax = max > 0 ? max : 100;
  const safeValue = clamp(value, 0, safeMax);
  const percent = Math.round((safeValue / safeMax) * 100);

  return (
    <div className={cn('flex w-full flex-col gap-1.5', className)}>
      {(showLabel || label) && (
        <div className="flex items-center justify-between">
          <span className="type-caption font-medium text-neutral-600">{label ?? 'Progresso'}</span>
          {showLabel && <span className="type-caption font-semibold text-neutral-700">{percent}%</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={Math.round(safeValue)}
        aria-label={label ?? 'Progresso'}
        className="h-2 w-full overflow-hidden rounded-full bg-neutral-200"
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-300', tones[tone])}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
