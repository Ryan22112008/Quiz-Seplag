import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, Home, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { Card, CardContent } from '@/components/ui/Card';
import { Container } from '@/components/layout/Container';
import { usePlayerStore } from '@/stores/playerStore';

/**
 * Lobby/waiting room page.
 * Route: /jogar/:pin/aguardando
 */
export function GameLobbyPage() {
  const { pin } = useParams<{ pin: string }>();
  const navigate = useNavigate();
  const { playerName, roomPin, clearPlayer } = usePlayerStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLeaveRoom = () => {
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
          <div className="flex flex-col items-center gap-2">
            <div className="flex size-16 items-center justify-center rounded-full bg-success-100 text-success-600">
              <Loader2 className="size-8 animate-spin" aria-hidden="true" />
            </div>
            <h1 className="type-h2 text-neutral-900">Você entrou! 🎮</h1>
          </div>

          <div className="surface-card w-full px-6 py-4">
            <p className="type-caption text-neutral-500">Sala</p>
            <p className="type-display text-primary-600 tabular-nums">{displayPin}</p>
          </div>

          <div className="flex flex-col gap-1">
            <p className="type-body text-neutral-600">Olá, {playerName}!</p>
            <p className="type-body-sm text-neutral-500">
              Aguardando o anfitrião iniciar a partida...
            </p>
          </div>

          <div className="flex gap-2">
            <div className="h-2 w-2 animate-bounce rounded-full bg-primary-500 [animation-delay:-0.3s]" />
            <div className="h-2 w-2 animate-bounce rounded-full bg-primary-500 [animation-delay:-0.15s]" />
            <div className="h-2 w-2 animate-bounce rounded-full bg-primary-500" />
          </div>

          <p className="type-body-sm text-neutral-400">Você está pronto!</p>

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
