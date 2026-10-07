import { Crown } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/cn';

export interface RankingItemProps {
  position: number;
  name: string;
  score: number;
  avatarSrc?: string | null;
  avatarCharacterId?: string | null;
  avatarAccessoryId?: string | null;
  highlighted?: boolean;
  streak?: number;
  className?: string;
}

const positionStyles: Record<number, string> = {
  1: 'bg-warning-400 text-warning-950',
  2: 'bg-neutral-200 text-neutral-700',
  3: 'bg-warning-200 text-warning-900',
};

/** Single ranking row — visual only, no real leaderboard logic. */
export function RankingItem({ position, name, score, avatarSrc, avatarCharacterId, avatarAccessoryId, highlighted = false, streak, className }: RankingItemProps) {
  return (
    <li
      aria-current={highlighted || undefined}
      className={cn(
        'flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors sm:px-4',
        highlighted ? 'border-primary-300 bg-primary-50' : 'border-border bg-surface',
        className,
      )}
    >
      <span
        aria-label={`Posição ${position}`}
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold tabular-nums',
          positionStyles[position] ?? 'bg-neutral-100 text-neutral-600',
        )}
      >
        {position === 1 ? <Crown className="size-4" aria-hidden="true" /> : position}
      </span>
      <Avatar name={name} src={avatarSrc} characterId={avatarCharacterId} accessoryId={avatarAccessoryId} size="sm" />
      <span title={name} className="type-body min-w-0 flex-1 truncate font-medium text-neutral-900">
        {name}
        {streak !== undefined && streak > 1 && (
          <span className="ml-2 rounded-full bg-warning-100 px-2 py-0.5 text-xs font-semibold text-warning-800">
            {streak}x
          </span>
        )}
      </span>
      <span className="type-label shrink-0 tabular-nums text-neutral-700">{score.toLocaleString('pt-BR')}</span>
    </li>
  );
}
