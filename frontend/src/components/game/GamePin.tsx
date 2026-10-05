import { useState } from 'react';
import { Check, Copy, Hash } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useToastStore } from '@/components/ui/useToastStore';

export interface GamePinProps {
  pin: string;
  size?: 'sm' | 'md' | 'lg';
  allowCopy?: boolean;
  className?: string;
}

const sizes = {
  sm: 'px-3 py-1.5 text-lg gap-2',
  md: 'px-5 py-3 text-2xl gap-3',
  lg: 'px-3 py-3 text-2xl gap-2 sm:px-8 sm:py-4 sm:text-4xl sm:gap-3',
} as const;

/** Large, easy-to-read room PIN with optional clipboard support. */
export function GamePin({ pin, size = 'md', allowCopy = true, className }: GamePinProps) {
  const [copied, setCopied] = useState(false);
  const pushToast = useToastStore((state) => state.push);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(pin);
      setCopied(true);
      pushToast({ variant: 'success', title: 'PIN copiado!' });
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={cn('flex flex-col items-center gap-1.5', className)}>
      <span className="text-xs font-semibold tracking-widest text-neutral-500 uppercase">PIN da sala</span>
      <div className="flex items-center gap-2">
        <span
          aria-label={`PIN da sala: ${pin.split('').join(' ')}`}
          className={cn(
            'inline-flex items-center rounded-2xl border border-border bg-surface font-display font-bold tracking-[0.12em] text-neutral-900 tabular-nums shadow-sm sm:tracking-[0.2em]',
            sizes[size],
          )}
        >
          <Hash className="size-[1em] shrink-0 text-primary-500" aria-hidden="true" />
          {pin.slice(0, 3)} {pin.slice(3)}
        </span>
        {allowCopy && (
          <button
            type="button"
            onClick={onCopy}
            aria-label={copied ? 'PIN copiado' : 'Copiar PIN'}
            className="rounded-xl border border-border bg-surface p-2.5 text-neutral-500 shadow-sm transition-colors hover:bg-neutral-50 hover:text-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
          >
            {copied ? (
              <Check className="size-5 text-success-600" aria-hidden="true" />
            ) : (
              <Copy className="size-5" aria-hidden="true" />
            )}
            <span className="text-sm font-semibold">{copied ? 'Copiado' : 'Copiar PIN'}</span>
          </button>
        )}
      </div>
      {copied && (
        <span role="status" className="text-xs font-medium text-success-700">
          PIN copiado!
        </span>
      )}
    </div>
  );
}
