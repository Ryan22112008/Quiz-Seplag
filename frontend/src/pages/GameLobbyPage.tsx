import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Home, LogOut, Play, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { Card, CardContent } from '@/components/ui/Card';
import { Container } from '@/components/layout/Container';
import { usePlayerStore } from '@/stores/playerStore';
import { useGameStore } from '@/stores/gameStore';
import { useRoomStore } from '@/stores/roomStore';
import { leaveRoomRealtime, subscribeRoom } from '@/services/realtime/session';
import { useToastStore } from '@/components/ui/useToastStore';
import { RealtimeConnectionNotice } from '@/components/game/RealtimeConnectionNotice';

/**
 * Lobby/waiting room page.
 * Route: /jogar/:pin/aguardando
 */
export function GameLobbyPage() {
  const { pin } = useParams<{ pin: string }>();
  const navigate = useNavigate();
  const { playerName, roomPin, clearPlayer } = usePlayerStore();
  const playerId = usePlayerStore((state) => state.playerId);
  const playerToken = usePlayerStore((state) => state.playerToken);
  const game = useGameStore((state) => pin ? state.games[pin] : undefined);
  const gameStatus = game?.status;
  const room = useRoomStore((state) => state.getRoom(pin ?? ''));
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!pin || !playerId || roomPin !== pin) return;
    void subscribeRoom(pin, playerId, undefined, playerToken)
      .catch((error: unknown) => useToastStore.getState().push({ variant: 'danger', title: 'Não foi possível atualizar a sala', description: error instanceof Error ? error.message : 'Verifique a conexão.' }));
  }, [pin, playerId, playerToken, roomPin]);

  useEffect(() => {
    if (gameStatus && gameStatus !== 'waiting' || room?.status === 'in-progress') navigate(`/jogar/${pin}/partida`);
    else if (room?.status === 'finished') navigate('/');
  }, [gameStatus, navigate, pin, room?.status]);

  const handleLeaveRoom = async () => {
    if (pin && playerId) {
      try { await leaveRoomRealtime(pin, playerId); }
      catch (error) { useToastStore.getState().push({ variant: 'danger', title: 'Não foi possível sair da sala', description: error instanceof Error ? error.message : 'Tente novamente.' }); return; }
    }
    clearPlayer();
    navigate('/');
  };

  // Prevent hydration mismatch
  if (!mounted) {
    return null;
  }

  // If player data is missing, show appropriate state
  if (!playerName || !roomPin) {
    return (
      <Container size="md" className="min-h-screen flex items-center justify-center py-12">
        <Card variant="elevated" className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-6 p-8 text-center">
            <h1 className="type-h2 text-neutral-900">Dados da sessão não encontrados</h1>
            <p className="type-body text-neutral-600">
              Parece que você acessou esta página diretamente. Por favor, entre na sala
              fornecendo seu nome primeiro.
            </p>
            <div className="flex flex-col gap-2 w-full">
              <ButtonLink to="/" size="lg" className="w-full">
                <Home className="size-4" aria-hidden="true" />
                Voltar para o início
              </ButtonLink>
              {pin && (
                <ButtonLink to={`/jogar/${pin}`} variant="outline" size="lg" className="w-full">
                  Entrar na sala novamente
                </ButtonLink>
              )}
            </div>
          </CardContent>
        </Card>
      </Container>
    );
  }

  const displayPin = pin || roomPin;

  return (
    <Container size="md" className="min-h-screen flex items-center justify-center py-12">
      <Card variant="elevated" className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-6 p-8 text-center">
          <div className="w-full text-left"><RealtimeConnectionNotice /></div>
          <div className="flex flex-col items-center gap-2">
            <div className="flex size-16 items-center justify-center rounded-full bg-success-100 text-success-600">
              <Play className="size-8" aria-hidden="true" />
            </div>
            <h1 className="type-h2 text-neutral-900">Você entrou! 🎮</h1>
          </div>

          <div className="surface-card w-full px-6 py-4">
            <p className="type-caption text-neutral-500">Sala</p>
            <p className="type-display text-primary-600 tabular-nums">{displayPin}</p>
          </div>

          <div className="flex flex-col gap-1">
            <p className="type-body text-neutral-600">Olá, {playerName}!</p>
            <p className="type-body-sm text-neutral-500">Aguardando o anfitrião iniciar a partida...</p>
            <p className="type-caption max-w-xs text-neutral-400">Você está conectado à sala e aguardando o início da partida.</p>
          </div>

          <p className="type-body-sm text-neutral-400">Você está pronto!</p>

          <div className="w-full rounded-xl border border-border bg-surface p-4 text-left">
            <p className="type-label mb-3 flex items-center gap-2 text-neutral-700"><Users className="size-4" aria-hidden="true" />Jogadores na sala ({room?.players.length ?? 0})</p>
            {room?.players.length ? <ul className="flex flex-col gap-2">{room.players.map((player) => <li key={player.id} className="rounded-lg bg-neutral-50 px-3 py-2 type-body-sm">{player.name}</li>)}</ul> : <p className="type-caption text-neutral-500">Aguardando participantes…</p>}
          </div>

          {game && game.status !== 'waiting' && game.status !== 'finished' && pin && (
            <ButtonLink to={`/jogar/${pin}/partida`} size="lg" className="w-full">
              <Play className="size-4" aria-hidden="true" />Abrir interface da partida
            </ButtonLink>
          )}

          <div className="w-full border-t border-border pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLeaveRoom}
              className="w-full text-neutral-500 hover:text-neutral-700"
            >
              <LogOut className="size-4" aria-hidden="true" />
              Sair da sala
            </Button>
          </div>
        </CardContent>
      </Card>
    </Container>
  );
}
