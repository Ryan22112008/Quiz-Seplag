import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';
import seplagLogo from '@/assets/logo-seplag-branco.png';

export interface LogoProps {
  tagline?: string;
  /** `null` renders the brand as plain text (no navigation). */
  to?: string | null;
  className?: string;
}

/**
 * Official SEPLAG mark with the existing Quiz SEPLAG wordmark.
 */
export function Logo({ tagline, to = '/', className }: LogoProps) {
  const content = (
    <>
      <img src={seplagLogo} alt="Logo SEPLAG" className="h-9 w-auto max-w-10 shrink-0 object-contain" />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="font-display text-base font-bold uppercase tracking-tight text-neutral-900">
          Quiz <span className="text-primary-400">SEPLAG</span>
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
