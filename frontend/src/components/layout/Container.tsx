import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type ContainerSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  size?: ContainerSize;
}

const sizes: Record<ContainerSize, string> = {
  sm: 'max-w-2xl',
  md: 'max-w-4xl',
  lg: 'max-w-6xl',
  xl: 'max-w-7xl',
  full: 'max-w-full',
};

/** Centered responsive page container (mobile-first, fluid gutters). */
export function Container({ size = 'lg', className, ...rest }: ContainerProps) {
  return <div className={cn('mx-auto w-full px-4 sm:px-6 lg:px-8', sizes[size], className)} {...rest} />;
}
