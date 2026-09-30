import { Badge } from '@/components/ui/Badge';
import type { BadgeVariant } from '@/components/ui/Badge';

export type GameStatusValue = 'waiting' | 'starting' | 'playing' | 'paused' | 'question' | 'locked' | 'results' | 'finished';

export interface GameStatusProps {
  status: GameStatusValue;
  className?: string;
}

const statusMap: Record<GameStatusValue, { label: string; variant: BadgeVariant }> = {
  waiting: { label: 'Aguardando', variant: 'default' },
  starting: { label: 'Iniciando', variant: 'primary' },
  playing: { label: 'Ao vivo', variant: 'success' },
  paused: { label: 'Pausado', variant: 'warning' },
  question: { label: 'Pergunta aberta', variant: 'success' },
  locked: { label: 'Pergunta encerrada', variant: 'warning' },
  results: { label: 'Resultados', variant: 'primary' },
  finished: { label: 'Encerrado', variant: 'neutral' },
};

/** Status pill for a game room. Visual only — no socket/state logic. */
export function GameStatus({ status, className }: GameStatusProps) {
  const { label, variant } = statusMap[status];
  return (
    <Badge variant={variant} className={className} aria-label={`Status do jogo: ${label}`}>
      {status === 'playing' && (
        <span className="relative flex size-2" aria-hidden="true">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-success-400 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-success-500" />
        </span>
      )}
      {label}
    </Badge>
  );
}
