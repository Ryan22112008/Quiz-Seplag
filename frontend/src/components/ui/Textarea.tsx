import { forwardRef, useId, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, helperText, error, id, disabled, className, rows = 4, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? `textarea-${autoId}`;
  const errorId = error ? `${fieldId}-error` : undefined;

  return (
    <div className={cn('flex w-full flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={fieldId} className="type-label text-neutral-700">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={cn(
          'w-full resize-y rounded-lg border bg-surface px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400',
          'transition-colors duration-150 focus:outline-2 focus:outline-offset-0',
          error
            ? 'border-danger-500 focus:border-danger-500 focus:outline-danger-500'
            : 'border-border-strong focus:border-primary-500 focus:outline-primary-500',
          'disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400',
        )}
        {...rest}
      />
      {helperText && !error && (
        <p className="type-caption text-neutral-500">{helperText}</p>
      )}
      {error && (
        <p id={errorId} role="alert" className="type-caption font-medium text-danger-600">
          {error}
        </p>
      )}
    </div>
  );
});
