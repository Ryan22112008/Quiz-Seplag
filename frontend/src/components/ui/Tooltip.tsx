import { useId, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

const positions: Record<NonNullable<TooltipProps['position']>, string> = {
  top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
  bottom: 'top-full left-1/2 mt-2 -translate-x-1/2',
  left: 'top-1/2 right-full mr-2 -translate-y-1/2',
  right: 'top-1/2 left-full ml-2 -translate-y-1/2',
};

/** Simple accessible tooltip (hover + focus). For complex content use Modal/Dropdown. */
export function Tooltip({ content, children, position = 'top', className }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const tooltipId = useId();

  return (
    <span
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      aria-describedby={visible ? tooltipId : undefined}
    >
      {children}
      {visible && (
        <span
          id={tooltipId}
          role="tooltip"
          className={cn(
            'animate-fade-in pointer-events-none absolute z-40 max-w-60 rounded-lg bg-neutral-900 px-2.5 py-1.5 text-xs leading-4 font-medium whitespace-normal text-white shadow-lg',
            positions[position],
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}
