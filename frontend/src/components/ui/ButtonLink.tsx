import { Link, type LinkProps } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { buttonClasses, type ButtonSize, type ButtonVariant } from './button-styles';

export interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/**
 * Navigation action with the exact same visuals as `Button`, but rendered as a
 * real anchor (react-router <Link>): keyboard, middle-click and context menu
 * keep working. Use it whenever the action goes to a route instead of running
 * imperative logic (in which case `Button` is the right element).
 */
export function ButtonLink({ variant = 'primary', size = 'md', className, ...rest }: ButtonLinkProps) {
  return <Link className={cn(buttonClasses(variant, size), className)} {...rest} />;
}
