import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/cn';

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

export interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
  className?: string;
}

const variants: Record<AlertVariant, { classes: string; Icon: typeof Info }> = {
  info: { classes: 'border-accent-200 bg-accent-50 text-accent-900', Icon: Info },
  success: { classes: 'border-success-200 bg-success-50 text-success-900', Icon: CheckCircle2 },
  warning: { classes: 'border-warning-200 bg-warning-50 text-warning-900', Icon: TriangleAlert },
  danger: { classes: 'border-danger-200 bg-danger-50 text-danger-900', Icon: AlertCircle },
};

export function Alert({ variant = 'info', title, children, className }: AlertProps) {
  const { classes, Icon } = variants[variant];
  const role = variant === 'danger' || variant === 'warning' ? 'alert' : 'status';
  return (
    <div role={role} className={cn('flex gap-3 rounded-xl border p-4', classes, className)}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-1">
        {title && <p className="type-label">{title}</p>}
        <div className="type-body">{children}</div>
      </div>
    </div>
  );
}
