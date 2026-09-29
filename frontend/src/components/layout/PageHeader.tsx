import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface PageHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions, className, ...rest }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between', className)} {...rest}>
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="type-h1 text-neutral-900">{title}</h1>
        {description && <p className="type-body max-w-2xl text-neutral-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
