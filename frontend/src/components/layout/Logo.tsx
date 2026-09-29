import { Link } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface LogoProps {
  tagline?: string;
  /** `null` renders the brand as plain text (no navigation). */
  to?: string | null;
  className?: string;
}

/**
 * Textual brand for the product: token-colored mark (Lucide glyph) + wordmark.
 * No external image/logo — only design system tokens and existing utilities.
 */
export function Logo({ tagline, to = '/', className }: LogoProps) {
  const content = (
    <>
      <span
        aria-hidden="true"
        className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary-600 to-accent-500 text-white shadow-sm"
      >
        <Zap className="size-5" />
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="font-display text-base font-bold uppercase tracking-tight text-neutral-900">
          Quiz <span className="text-primary-600">SEPLAG</span>
        </span>
        {tagline && <span className="type-caption text-neutral-500">{tagline}</span>}
      </span>
    </>
  );

  const classes = cn(
    'inline-flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500',
    className,
  );

  if (to === null) return <span className={classes}>{content}</span>;

  return (
    <Link to={to} className={classes} aria-label="Quiz SEPLAG — página inicial">
      {content}
    </Link>
  );
}
