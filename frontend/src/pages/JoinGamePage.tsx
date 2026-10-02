import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Home } from 'lucide-react';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/Card';
import { Container } from '@/components/layout/Container';
import { Input } from '@/components/ui/Input';
import { usePlayerStore } from '@/stores/playerStore';
import { baseTextSchema } from '@/lib/validators';
import { api, toFrontendRoom } from '@/services/api/client';
import { subscribeRoom } from '@/services/realtime/session';
import { useRoomStore } from '@/stores/roomStore';
import { useToastStore } from '@/components/ui/useToastStore';
import { useState } from 'react';

const playerNameSchema = baseTextSchema
  .min(2, 'O nome deve ter pelo menos 2 caracteres')
  .max(20, 'O nome deve ter no máximo 20 caracteres')
  .refine((name) => name.trim().length > 0, 'Nome do jogador é obrigatório');

const joinRoomSchema = z.object({
  playerName: playerNameSchema,
});

type JoinRoomValues = z.infer<typeof joinRoomSchema>;

/**
 * Room entry page with PIN display and player name form.
 * Route: /jogar/:pin
 */
export function JoinGamePage() {
  const { pin } = useParams<{ pin: string }>();
  const navigate = useNavigate();
  const setIdentity = usePlayerStore((state) => state.setIdentity);
  const upsertRoom = useRoomStore((state) => state.upsertRoom);
  const [joining, setJoining] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<JoinRoomValues>({
    resolver: zodResolver(joinRoomSchema),
    mode: 'onTouched',
    defaultValues: { playerName: '' },
  });

  const onValidSubmit = async (values: JoinRoomValues) => {
    if (!pin || joining) return;
    setJoining(true);
    try {
      const joined = await api.joinRoom(pin, values.playerName.trim());
      upsertRoom(toFrontendRoom(joined.room));
      setIdentity({ playerId: joined.player.id, roomId: joined.room.id, roomPin: pin, playerName: joined.player.name });
      await subscribeRoom(pin, joined.player.id);
      navigate(`/jogar/${pin}/aguardando`);
    } catch (error) {
      useToastStore.getState().push({ variant: 'danger', title: 'Não foi possível entrar na sala', description: error instanceof Error ? error.message : 'Confira o PIN e tente novamente.' });
    } finally { setJoining(false); }
  };

  if (!pin) {
    return (
      <Container size="md" className="min-h-screen flex items-center justify-center py-12">
        <Card variant="elevated" className="w-full max-w-md">
          <CardHeader>
            <h1 className="type-h2 text-neutral-900">PIN não encontrado</h1>
            <CardDescription>
              Não foi possível identificar o PIN da sala. Por favor, tente novamente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ButtonLink to="/" size="lg" className="w-full">
              <Home className="size-4" aria-hidden="true" />
              Voltar para o início
            </ButtonLink>
          </CardContent>
        </Card>
      </Container>
    );
  }

  return (
    <Container size="md" className="min-h-screen flex items-center justify-center py-12">
      <Card variant="elevated" className="w-full max-w-md">
        <CardHeader>
          <h1 className="type-h2 text-neutral-900 text-center">Entrar na sala</h1>
          <div className="my-4 flex justify-center">
            <div className="surface-card px-6 py-3">
              <p className="type-caption text-neutral-500 text-center">PIN da sala</p>
              <p className="type-display text-primary-600 text-center tabular-nums">{pin}</p>
            </div>
          </div>
          <CardDescription className="text-center">
            Como devemos chamar você?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            noValidate
            onSubmit={handleSubmit(onValidSubmit)}
          >
            <Input
              {...register('playerName')}
              label="Nome do jogador"
              placeholder="Seu nome"
              size="lg"
              autoComplete="off"
              maxLength={20}
              error={errors.playerName?.message}
              inputClassName="text-center"
            />
            <Button type="submit" size="lg" className="w-full" disabled={joining}>
              {joining ? 'Entrando…' : 'Entrar na sala'}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </form>
          <div className="mt-4 text-center">
            <ButtonLink to="/" variant="ghost" size="sm">
              <Home className="size-4" aria-hidden="true" />
              Voltar para o início
            </ButtonLink>
          </div>
        </CardContent>
      </Card>
    </Container>
  );
}
