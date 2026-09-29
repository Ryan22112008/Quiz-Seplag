import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  lines?: number;
}

/** Content placeholder with reduced-motion support (handled globally). */
export function Skeleton({ lines = 1, className, ...rest }: SkeletonProps) {
  if (lines <= 1) {
    return <div aria-hidden="true" className={cn('animate-pulse rounded-lg bg-neutral-200', className)} {...rest} />;
  }
  return (
    <div className={cn('flex flex-col gap-2', className)} aria-hidden="true" {...rest}>
      {Array.from({ length: lines }, (_, index) => (
        <div
          key={index}
          className={cn('h-4 animate-pulse rounded-md bg-neutral-200', index === lines - 1 && 'w-2/3')}
        />
      ))}
    </div>
  );
}
