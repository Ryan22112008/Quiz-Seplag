import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type CardVariant = 'default' | 'interactive' | 'elevated' | 'outlined';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

const variants: Record<CardVariant, string> = {
  default: 'border border-border bg-surface shadow-sm',
  interactive:
    'cursor-pointer border border-border bg-surface shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-md',
  elevated: 'border border-border bg-surface shadow-lg',
  outlined: 'border-2 border-border bg-surface shadow-none',
};

export function Card({ variant = 'default', className, ...rest }: CardProps) {
  return <div className={cn('rounded-xl', variants[variant], className)} {...rest} />;
}

export function CardHeader({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1 p-5 pb-0 sm:p-6 sm:pb-0', className)} {...rest} />;
}

export function CardTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('type-h4 text-neutral-900', className)} {...rest} />;
}

export function CardDescription({ className, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('type-body-sm text-neutral-500', className)} {...rest} />;
}

export function CardContent({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5 sm:p-6', className)} {...rest} />;
}

export function CardFooter({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-wrap items-center gap-2 p-5 pt-0 sm:p-6 sm:pt-0', className)}
      {...rest}
    />
  );
}
