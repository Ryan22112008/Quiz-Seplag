import { useCallback, useState, type ReactNode } from 'react';
import { Timer } from './Timer';

/** Displays choices only when the server supplied absolute reveal deadline has elapsed. */
export function RevealGate({ revealAt, children }: { revealAt: string; children: ReactNode }) {
  const deadline = Date.parse(revealAt);
  const [revealed, setRevealed] = useState(() => !Number.isFinite(deadline) || Date.now() >= deadline);
  const reveal = useCallback(() => setRevealed(true), []);
  if (revealed) return children;

  return <div className="flex min-h-28 flex-col items-center justify-center gap-3 rounded-xl border border-primary-100 bg-primary-50/70 p-5 text-center" aria-live="polite">
    <Timer duration={Math.max(1, Math.ceil((deadline - Date.now()) / 1000))} endsAt={deadline} size="sm" label="Tempo até mostrar as alternativas" onExpire={reveal} />
    <p className="type-body-sm font-medium text-neutral-700">Leia a pergunta. As alternativas aparecerão em seguida.</p>
  </div>;
}
