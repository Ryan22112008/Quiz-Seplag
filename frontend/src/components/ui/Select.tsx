import { forwardRef, useId, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  error?: string;
  placeholder?: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, helperText, error, id, disabled, className, placeholder, options, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? `select-${autoId}`;
  const errorId = error ? `${fieldId}-error` : undefined;

  return (
    <div className={cn('flex w-full flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={fieldId} className="type-label text-neutral-700">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={fieldId}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className={cn(
            'h-10 w-full appearance-none rounded-lg border bg-surface py-2 pr-10 pl-3 text-sm text-neutral-900',
            'transition-colors duration-150 focus:outline-2 focus:outline-offset-0',
            error
              ? 'border-danger-500 focus:border-danger-500 focus:outline-danger-500'
              : 'border-border-strong focus:border-primary-500 focus:outline-primary-500',
            'disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400',
          )}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-neutral-400"
          aria-hidden="true"
        />
      </div>
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
