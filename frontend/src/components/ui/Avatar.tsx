import type { ImgHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null;
  name: string;
  size?: AvatarSize;
}

const sizes: Record<AvatarSize, string> = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-12 text-base',
  xl: 'size-16 text-lg',
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return (parts[0] as string).slice(0, 2).toUpperCase();
  const first = parts[0] as string;
  const last = parts[parts.length - 1] as string;
  return `${first[0]}${last[0]}`.toUpperCase();
}

/** Avatar with image fallback to initials. Always carries an accessible label. */
export function Avatar({ src, name, size = 'md', alt, className, ...rest }: AvatarProps) {
  const label = alt ?? name;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-100 font-semibold text-primary-700 ring-1 ring-primary-200',
        sizes[size],
        className,
      )}
      role={src ? undefined : 'img'}
      aria-label={src ? undefined : label}
    >
      {src ? (
        <img src={src} alt={label} loading="lazy" className="size-full object-cover" {...rest} />
      ) : (
        <span aria-hidden="true">{initialsOf(name)}</span>
      )}
    </span>
  );
}
