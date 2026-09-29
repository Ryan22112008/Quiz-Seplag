/**
 * Joins class names, ignoring falsy values.
 * Local alternative to `clsx` — no extra dependency needed.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
