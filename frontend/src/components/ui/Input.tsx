import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type InputSize = 'md' | 'lg';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  helperText?: string;
  error?: string;
  /** `lg` is the comfortable touch/hero size (PIN fields, prominent forms). */
  size?: InputSize;
  /** Extra classes for the <input> itself (e.g. a centered PIN field). */
  inputClassName?: string;
}

const inputSizes: Record<InputSize, string> = {
  md: 'h-10 px-3 text-sm',
  lg: 'h-14 rounded-xl px-4 text-lg sm:h-16 sm:text-2xl',
};

/** Labeled text input with helper/error states wired via aria attributes. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    helperText,
    error,
    id,
    disabled,
    className,
    size = 'md',
    inputClassName,
    'aria-describedby': describedBy,
    ...rest
  },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? `input-${autoId}`;
  const helperId = helperText ? `${inputId}-helper` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className={cn('flex w-full flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={inputId} className="type-label text-neutral-700">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={[describedBy, helperId, errorId].filter(Boolean).join(' ') || undefined}
        className={cn(
          'w-full border bg-surface text-neutral-900 placeholder:text-neutral-400',
          'transition-colors duration-150 focus:outline-2 focus:outline-offset-0',
          error
            ? 'border-danger-500 focus:border-danger-500 focus:outline-danger-500'
            : 'border-border-strong focus:border-primary-500 focus:outline-primary-500',
          'disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400',
          size === 'md' && 'rounded-lg',
          inputSizes[size],
          inputClassName,
        )}
        {...rest}
      />
      {helperText && !error && (
        <p id={helperId} className="type-caption text-neutral-500">
          {helperText}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="type-caption font-medium text-danger-600">
          {error}
        </p>
      )}
    </div>
  );
});
