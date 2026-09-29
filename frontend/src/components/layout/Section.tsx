import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface SectionProps extends HTMLAttributes<HTMLElement> {
  title?: string;
  description?: string;
}

/** Semantic content section with optional heading. */
export function Section({ title, description, className, children, ...rest }: SectionProps) {
  return (
    <section className={cn('flex flex-col gap-4', className)} {...rest}>
      {(title || description) && (
        <div className="flex flex-col gap-1">
          {title && <h2 className="type-h3 text-neutral-900">{title}</h2>}
          {description && <p className="type-body text-neutral-500">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}
