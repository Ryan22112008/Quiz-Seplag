import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
}

/** Accessible checkbox with a real input; label click toggles the control. */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, error, id, disabled, className, checked, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? `checkbox-${autoId}`;
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
        <span className="relative inline-flex shrink-0">
          <input
            ref={ref}
            id={fieldId}
            type="checkbox"
            disabled={disabled}
            checked={checked}
            aria-invalid={error ? true : undefined}
            aria-describedby={errorId}
            className="peer sr-only"
            {...rest}
          />
          <span
            aria-hidden="true"
            className={cn(
              'flex size-5 items-center justify-center rounded-md border-2 transition-colors duration-150',
              'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary-500',
              error
                ? 'border-danger-500 peer-checked:border-danger-600 peer-checked:bg-danger-600'
                : 'border-neutral-300 bg-surface peer-checked:border-primary-600 peer-checked:bg-primary-600',
              'peer-checked:[&_svg]:opacity-100 peer-disabled:bg-neutral-100',
            )}
          >
            <Check className="size-3.5 text-white opacity-0" strokeWidth={3} />
          </span>
        </span>
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
