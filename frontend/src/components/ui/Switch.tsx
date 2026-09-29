import { forwardRef, useId, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'value'> {
  label?: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  error?: string;
}

/** Toggle switch built on a real <button role="switch"> for keyboard support. */
export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { label, checked = false, onCheckedChange, id, disabled, className, error, onClick, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? `switch-${autoId}`;
  const errorId = error ? `${fieldId}-error` : undefined;

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className={cn('inline-flex items-center gap-2.5', disabled && 'opacity-60')}>
        <button
          ref={ref}
          id={fieldId}
          type="button"
          role="switch"
          aria-checked={checked}
          aria-describedby={errorId}
          disabled={disabled}
          onClick={(event) => {
            onClick?.(event);
            if (!event.defaultPrevented) onCheckedChange?.(!checked);
          }}
          className={cn(
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-150',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500',
            checked ? 'bg-primary-600' : 'bg-neutral-300',
            'disabled:cursor-not-allowed disabled:opacity-60',
          )}
          {...rest}
        >
          <span
            aria-hidden="true"
            className={cn(
              'inline-block size-5 transform rounded-full bg-white shadow-sm transition-transform duration-150',
              checked ? 'translate-x-[22px]' : 'translate-x-[2px]',
            )}
          />
        </button>
        {label && (
          <label htmlFor={fieldId} className={cn('type-body cursor-pointer text-neutral-700', disabled && 'cursor-not-allowed')}>
            {label}
          </label>
        )}
      </span>
      {error && (
        <p id={errorId} role="alert" className="type-caption font-medium text-danger-600">
          {error}
        </p>
      )}
    </div>
  );
});
