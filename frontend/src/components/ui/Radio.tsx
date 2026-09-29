import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { label, error, id, disabled, className, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? `radio-${autoId}`;
  const errorId = error ? `${fieldId}-error` : undefined;

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label
        htmlFor={fieldId}
        className={cn(
          'inline-flex cursor-pointer items-center gap-2.5',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <input
          ref={ref}
          id={fieldId}
          type="radio"
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className={cn(
            'size-5 shrink-0 cursor-pointer appearance-none rounded-full border-2 transition-colors duration-150',
            'checked:border-[5px]',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500',
            error ? 'border-danger-500 checked:border-danger-600' : 'border-neutral-300 checked:border-primary-600',
            'disabled:cursor-not-allowed disabled:bg-neutral-100',
          )}
          {...rest}
        />
        {label && <span className="type-body text-neutral-700">{label}</span>}
      </label>
      {error && (
        <p id={errorId} role="alert" className="type-caption font-medium text-danger-600">
          {error}
        </p>
      )}
    </div>
  );
});
