import { Trophy } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { selectPodiumEntries } from '@/lib/finalPodium.mjs';
import type { RankingEntry } from '@/types/game';

interface FinalPodiumProps {
  entries: RankingEntry[];
  animate?: boolean;
}

const podiumOrder = [3, 2, 1] as const;
const placeStyle: Record<number, { medal: string; pedestal: string; height: string }> = {
  1: { medal: 'bg-amber-300 text-amber-950 ring-amber-100', pedestal: 'from-amber-300 to-amber-500', height: 'h-32 sm:h-36' },
  2: { medal: 'bg-slate-200 text-slate-800 ring-white', pedestal: 'from-slate-300 to-slate-500', height: 'h-24 sm:h-28' },
  3: { medal: 'bg-orange-300 text-orange-950 ring-orange-100', pedestal: 'from-orange-300 to-orange-500', height: 'h-20 sm:h-24' },
};

/** Final podium uses the server's ordered ranking; it only chooses the visual slots. */
export function FinalPodium({ entries, animate = false }: FinalPodiumProps) {
  const topThree = selectPodiumEntries(entries);
  if (topThree.length === 0) return null;

  const revealOrder = [3, 2, 1].filter((position) => topThree.some((entry) => entry.position === position));
  const delayFor = (position: number) => revealOrder.indexOf(position) * 650;

  return (
    <section aria-labelledby="final-podium-title" className="mx-auto mb-8 w-full max-w-4xl overflow-hidden rounded-3xl bg-gradient-to-br from-[#102557] via-[#1d4ed8] to-[#0b1736] px-3 py-8 text-white shadow-xl sm:mb-10 sm:px-8 sm:py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-white/10 text-amber-200 ring-1 ring-white/20"><Trophy className="size-6" aria-hidden="true" /></div>
        <p className="type-caption font-bold uppercase tracking-[0.24em] text-blue-100">Grande final</p>
        <h2 id="final-podium-title" className="type-h2 mt-1 text-white">Pódio final</h2>
        <p className="type-body-sm mt-2 text-blue-100">Conheça quem chegou ao topo</p>
      </div>

      <div className="grid grid-cols-3 items-end gap-1.5 sm:gap-5" role="list" aria-label="Três primeiros colocados">
        {podiumOrder.map((position) => {
          const entry = topThree.find((item) => item.position === position);
          if (!entry) return null;
          const style = placeStyle[position]!;
          const delay = delayFor(position);
          return (
            <article key={entry.playerId} role="listitem" aria-label={`${position}º lugar: ${entry.playerName}, ${entry.score.toLocaleString('pt-BR')} pontos`} className={`relative flex min-w-0 flex-col items-center justify-end text-center ${animate ? 'podium-reveal' : ''}`} style={{ gridColumn: position === 1 ? 2 : position === 2 ? 1 : 3, gridRow: 1, ...(animate ? { animationDelay: `${delay}ms` } : {}) }}>
              {position === 1 && animate && <div className="podium-confetti" aria-hidden="true">{Array.from({ length: 8 }, (_, index) => <i key={index} />)}</div>}
              <span className={`relative z-10 mb-2 flex size-9 items-center justify-center rounded-full text-sm font-black ring-4 sm:size-11 sm:text-base ${style.medal} ${position === 1 && animate ? 'podium-winner-glow' : ''}`}>{position}º</span>
              <Avatar name={entry.playerName} characterId={entry.avatarCharacterId} accessoryId={entry.avatarAccessoryId} size={position === 1 ? 'lg' : 'md'} className={`relative z-10 mb-2 ring-2 ring-white/80 ${position === 1 ? 'sm:size-16' : ''}`} />
              <h3 className={`relative z-10 w-full break-words px-0.5 font-bold leading-tight text-white ${position === 1 ? 'text-sm sm:text-xl' : 'text-xs sm:text-base'}`}>{entry.playerName}</h3>
              <p className={`relative z-10 mt-1 font-semibold tabular-nums text-blue-100 ${position === 1 ? 'text-xs sm:text-sm' : 'text-[10px] sm:text-xs'}`}>{entry.score.toLocaleString('pt-BR')} pts</p>
              <div className={`podium-block relative mt-3 flex w-full shrink-0 items-center justify-center rounded-t-xl bg-gradient-to-b ${style.pedestal} ${style.height} text-2xl font-black text-white shadow-inner ${position === 1 ? 'text-3xl' : ''} ${animate ? 'podium-block-rise' : ''}`} style={animate ? { animationDelay: `${delay + 120}ms` } : undefined} aria-hidden="true">{position}</div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
