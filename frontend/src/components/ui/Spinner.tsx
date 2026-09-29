import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export type SpinnerSize = 'sm' | 'md' | 'lg';

export interface SpinnerProps {
  size?: SpinnerSize;
  label?: string;
  className?: string;
}

const sizes: Record<SpinnerSize, string> = {
  sm: 'size-4',
  md: 'size-6',
  lg: 'size-10',
};

/** Visual loading indicator. Pair with an accessible label when used alone. */
export function Spinner({ size = 'md', label = 'Carregando…', className }: SpinnerProps) {
  return (
    <span role="status" aria-label={label} className={cn('inline-flex items-center justify-center', className)}>
      <Loader2 className={cn('animate-spin text-primary-600', sizes[size])} aria-hidden="true" />
    </span>
  );
}
