import { EmptyState } from '@/components/ui/EmptyState';
import { RankingItem } from '@/components/quiz/RankingItem';
import type { RankingEntry } from '@/types/game';

export interface RankingListProps {
  entries: RankingEntry[];
  highlightPlayerId?: string;
  emptyMessage?: string;
}

export function RankingList({ entries, highlightPlayerId, emptyMessage = 'Nenhum resultado disponível.' }: RankingListProps) {
  if (entries.length === 0) return <EmptyState title={emptyMessage} className="py-8" />;

  return (
    <ol aria-label="Ranking da partida" className="flex min-w-0 flex-col gap-2">
      {entries.map((entry) => (
        <RankingItem
          key={entry.playerId}
          position={entry.position}
          name={entry.playerName}
          avatarCharacterId={entry.avatarCharacterId}
          avatarAccessoryId={entry.avatarAccessoryId}
          score={entry.score}
          highlighted={entry.playerId === highlightPlayerId}
        />
      ))}
    </ol>
  );
}
