import { useEffect, useState } from 'react';
import { Timer as TimerIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface TimerProps {
  duration: number;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  onExpire?: () => void;
  className?: string;
}

const sizes = {
  sm: { ring: 'size-12 text-sm', icon: 'size-3.5' },
  md: { ring: 'size-16 text-lg', icon: 'size-4' },
  lg: { ring: 'size-24 text-2xl', icon: 'size-5' },
} as const;

/**
 * Visual countdown only — local interval for preview purposes.
 * Real sync with the server will be added in a later step.
 */
export function Timer({ duration, size = 'md', label = 'Tempo restante', onExpire, className }: TimerProps) {
  const safeDuration = Math.max(1, Math.floor(duration));
  const [remaining, setRemaining] = useState(safeDuration);

  useEffect(() => {
    setRemaining(safeDuration);
  }, [safeDuration]);

  useEffect(() => {
    if (remaining <= 0) {
      onExpire?.();
      return;
    }
    const id = window.setTimeout(() => setRemaining((value) => value - 1), 1000);
    return () => window.clearTimeout(id);
  }, [remaining, onExpire]);

  const fraction = remaining / safeDuration;
  const urgent = fraction <= 0.25;
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const stroke = size === 'lg' ? 7 : 5;

  return (
    <div className={cn('flex flex-col items-center gap-1.5', className)}>
      <div
        role="timer"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={safeDuration}
        aria-valuenow={remaining}
        className={cn('relative inline-flex items-center justify-center', sizes[size].ring)}
      >
        <svg viewBox="0 0 64 64" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
          <circle cx="32" cy="32" r={radius} fill="none" strokeWidth={stroke} className="stroke-neutral-200" />
          <circle
            cx="32"
            cy="32"
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - fraction)}
            className={cn('transition-[stroke-dashoffset] duration-500', urgent ? 'stroke-danger-500' : 'stroke-primary-600')}
          />
        </svg>
        <span className={cn('font-display font-bold tabular-nums', urgent ? 'text-danger-700' : 'text-neutral-900')}>
          {remaining}
        </span>
      </div>
      <span className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500">
        <TimerIcon className={sizes[size].icon} aria-hidden="true" />
        {urgent ? 'Tempo acabando!' : `${remaining}s`}
      </span>
    </div>
  );
}
