/**
 * Shared visual recipe for the primary action element.
 * Lives outside the component files so `Button` (semantic <button>) and
 * `ButtonLink` (semantic react-router <Link>) share exactly one source of truth.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export const buttonBase =
  'inline-flex items-center justify-center transition-colors duration-150 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 ' +
  'disabled:cursor-not-allowed disabled:text-neutral-400';

export const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 disabled:bg-neutral-200',
  secondary:
    'bg-neutral-900 text-white hover:bg-neutral-800 active:bg-neutral-950 disabled:bg-neutral-200',
  outline:
    'border border-border-strong bg-surface text-neutral-800 hover:border-neutral-400 hover:bg-neutral-50 active:bg-neutral-100 disabled:bg-neutral-50',
  ghost:
    'bg-transparent text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200 disabled:bg-transparent',
  danger:
    'bg-danger-600 text-white hover:bg-danger-700 active:bg-danger-800 disabled:bg-neutral-200',
  success:
    'bg-success-600 text-white hover:bg-success-700 active:bg-success-800 disabled:bg-neutral-200',
};

export const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 rounded-lg px-3 text-[0.8125rem] font-medium',
  md: 'h-10 gap-2 rounded-lg px-4 text-sm font-medium',
  lg: 'h-12 gap-2 rounded-xl px-6 text-base font-semibold',
  icon: 'size-10 rounded-lg p-0',
};

export function buttonClasses(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className?: string,
): string {
  return [buttonBase, buttonVariants[variant], buttonSizes[size], className]
    .filter(Boolean)
    .join(' ');
}
