import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, Home, Pencil } from 'lucide-react';
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
import { Avatar } from '@/components/ui/Avatar';
import { AvatarPickerModal } from '@/components/game/AvatarPickerModal';
import { useEffect, useState } from 'react';
import { resolveRoomPin } from '@/lib/roomJoinUrl.mjs';

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
  const { pin: routePin } = useParams<{ pin: string }>();
  const [searchParams] = useSearchParams();
  const pin = resolveRoomPin(routePin, searchParams.get('pin')) ?? '';
  const navigate = useNavigate();
  const setIdentity = usePlayerStore((state) => state.setIdentity);
  const playerId = usePlayerStore((state) => state.playerId);
  const playerToken = usePlayerStore((state) => state.playerToken);
  const avatarCharacterId = usePlayerStore((state) => state.avatarCharacterId);
  const avatarAccessoryId = usePlayerStore((state) => state.avatarAccessoryId);
  const setAvatar = usePlayerStore((state) => state.setAvatar);
  const existingRoomPin = usePlayerStore((state) => state.roomPin);
  const upsertRoom = useRoomStore((state) => state.upsertRoom);
  const [joining, setJoining] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [validation, setValidation] = useState<{ pin: string; status: 'loading' | 'valid' | 'invalid'; message: string }>({ pin: '', status: 'loading', message: 'Verificando o PIN da sala…' });
  const roomValidation = validation.pin === pin ? validation.status : 'loading';
  const roomValidationMessage = validation.pin === pin ? validation.message : 'Verificando o PIN da sala…';

  useEffect(() => {
    let current = true;
    if (!pin) {
      setValidation({ pin, status: 'invalid', message: 'O link não contém um PIN válido de seis dígitos.' });
      return () => { current = false; };
    }
    setValidation({ pin, status: 'loading', message: 'Verificando o PIN da sala…' });
    void api.getRoom(pin).then((room) => {
      if (!current) return;
      if (room.status === 'FINISHED') {
        setValidation({ pin, status: 'invalid', message: 'Esta sala já foi encerrada. Peça ao anfitrião um novo PIN.' });
        return;
      }
      setValidation({ pin, status: 'valid', message: '' });
    }).catch((error: unknown) => {
      if (!current) return;
      setValidation({ pin, status: 'invalid', message: error instanceof Error ? error.message : 'Não foi possível localizar esta sala. Confira o PIN e tente novamente.' });
    });
    return () => { current = false; };
  }, [pin]);

  useEffect(() => {
    if (validation.pin !== pin || validation.status !== 'valid' || !pin || !playerId || existingRoomPin !== pin) return;
    let current = true;
    void subscribeRoom(pin, playerId, undefined, playerToken).then(() => { if (current) navigate(`/jogar/${pin}/aguardando`, { replace: true }); }).catch((error: unknown) => {
      if (hasErrorCode(error, 'PLAYER_NOT_FOUND')) usePlayerStore.getState().clearPlayer();
      if (current) useToastStore.getState().push({ variant: 'danger', title: 'Não foi possível recuperar sua sessão', description: error instanceof Error ? error.message : 'Entre novamente na sala.' });
    });
    return () => { current = false; };
  }, [existingRoomPin, navigate, pin, playerId, playerToken, validation]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<JoinRoomValues>({
    resolver: zodResolver(joinRoomSchema),
    mode: 'onTouched',
    defaultValues: { playerName: '' },
  });
  const enteredPlayerName = watch('playerName');

  const onValidSubmit = async (values: JoinRoomValues) => {
    if (roomValidation !== 'valid' || !pin || joining) return;
    setJoining(true);
    try {
      const existing = usePlayerStore.getState();
      if (existing.playerId && existing.roomPin === pin) {
        await subscribeRoom(pin, existing.playerId, undefined, existing.playerToken);
        navigate(`/jogar/${pin}/aguardando`);
        return;
      }
      const joined = await api.joinRoom(pin, values.playerName.trim(), avatarCharacterId, avatarAccessoryId);
      upsertRoom(toFrontendRoom(joined.room));
      setIdentity({ playerId: joined.player.id, roomId: joined.room.id, roomPin: pin, playerName: joined.player.name, playerToken: joined.playerToken, avatarCharacterId, avatarAccessoryId });
      await subscribeRoom(pin, joined.player.id, undefined, joined.playerToken);
      navigate(`/jogar/${pin}/aguardando`);
    } catch (error) {
      useToastStore.getState().push({ variant: 'danger', title: 'Não foi possível entrar na sala', description: error instanceof Error ? error.message : 'Confira o PIN e tente novamente.' });
    } finally { setJoining(false); }
  };

  if (roomValidation !== 'valid') {
    return (
      <Container size="md" className="min-h-screen flex items-center justify-center py-12">
        <Card variant="elevated" className="w-full max-w-md">
          <CardHeader>
            <h1 className="type-h2 text-neutral-900">{roomValidation === 'loading' ? 'Verificando sala' : 'Sala indisponível'}</h1>
            <CardDescription>
              {roomValidation === 'loading' ? 'Estamos confirmando se o PIN corresponde a uma sala ativa.' : roomValidationMessage}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {roomValidation === 'loading' ? <p className="type-body-sm text-center text-neutral-500" role="status">{roomValidationMessage}</p> : <ButtonLink to="/" size="lg" className="w-full">
              <Home className="size-4" aria-hidden="true" />
              Voltar para o início
            </ButtonLink>}
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
            <div className="flex justify-center">
              <button type="button" onClick={() => setAvatarOpen(true)} className="group flex items-center gap-3 rounded-xl border border-border bg-surface-muted px-4 py-2.5 text-left transition hover:border-primary-400 hover:bg-primary-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500">
                <span className="relative"><Avatar name="Seu avatar" size="md" characterId={avatarCharacterId} accessoryId={avatarAccessoryId} /><span className="absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full bg-primary-600 text-white shadow-sm"><Pencil className="size-3" /></span></span>
                <span><span className="block text-sm font-semibold text-neutral-900">Escolher avatar</span><span className="block text-xs text-neutral-500">Personalize como você aparece no jogo</span></span>
              </button>
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={joining || roomValidation !== 'valid'}>
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
      <AvatarPickerModal open={avatarOpen} name={enteredPlayerName || 'Jogador'} characterId={avatarCharacterId} onClose={() => setAvatarOpen(false)} onSave={(characterId) => { setAvatar(characterId, 'none'); setAvatarOpen(false); }} />
    </Container>
  );
}

function hasErrorCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}
