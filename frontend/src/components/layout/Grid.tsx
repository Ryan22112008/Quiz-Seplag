import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface GridProps extends HTMLAttributes<HTMLDivElement> {
  columns?: 1 | 2 | 3 | 4;
}

const columns: Record<NonNullable<GridProps['columns']>, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
};

/** Responsive grid — mobile stacks, breakpoints add columns automatically. */
export function Grid({ columns: cols = 2, className, ...rest }: GridProps) {
  return <div className={cn('grid gap-4 sm:gap-6', columns[cols], className)} {...rest} />;
}
