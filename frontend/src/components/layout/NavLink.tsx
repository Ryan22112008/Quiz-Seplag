import type { LinkProps } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';

export interface NavLinkProps extends Omit<LinkProps, 'href' | 'to'> {
  /** Plain anchor for in-page targets such as `#como-funciona`. */
  href?: string;
  /** Router link target. Either `to` or `href` should be provided. */
  to?: string;
  current?: boolean;
}

/**
 * Quiet text navigation link shared by header/footer so both stay identical.
 * Always renders a real <a> (router Link when a route is given).
 */
export function NavLink({ to, href, current = false, className, children, ...rest }: NavLinkProps) {
  const classes = cn(
    'type-label inline-flex items-center gap-2 rounded-lg px-3 py-2 transition-colors duration-150',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500',
    'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
    current && 'bg-neutral-100 text-neutral-900',
    className,
  );

  if (href) {
    return (
      <a href={href} className={classes} aria-current={current ? 'page' : undefined} {...rest}>
        {children}
      </a>
    );
  }

  return (
    <Link to={to ?? '/'} className={classes} aria-current={current ? 'page' : undefined} {...rest}>
      {children}
    </Link>
  );
}
