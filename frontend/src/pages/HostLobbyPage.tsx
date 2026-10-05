import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CircleHelp, DoorOpen, Home, Play, Users } from 'lucide-react';
import { Container } from '@/components/layout/Container';
import { Logo } from '@/components/layout/Logo';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { GamePin } from '@/components/game/GamePin';
import { GameStatus } from '@/components/game/GameStatus';
import { PlayerCount } from '@/components/game/PlayerCount';
import { useQuizStore } from '@/stores/quizStore';
import { useRoomStore } from '@/stores/roomStore';
import { useGameStore } from '@/stores/gameStore';
import { QUIZ_CATEGORIES } from '@/types/quiz';
import { api } from '@/services/api/client';
import { subscribeRoom, sendCommand, closeRoomRealtime } from '@/services/realtime/session';
import { useToastStore } from '@/components/ui/useToastStore';
import { RealtimeConnectionNotice } from '@/components/game/RealtimeConnectionNotice';
import { useRealtimeStore } from '@/stores/realtimeStore';
import { QRCodeSVG } from 'qrcode.react';
import { buildRoomJoinUrl } from '@/lib/roomJoinUrl.mjs';

export function HostLobbyPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const [confirmClose, setConfirmClose] = useState(false);
  const quiz = useQuizStore((state) => quizId ? state.getQuizById(quizId) : undefined);
  const upsertQuiz = useQuizStore((state) => state.upsertQuiz);
  const [loadingQuiz, setLoadingQuiz] = useState(Boolean(quizId && !quiz));
  const room = useRoomStore((state) => state.rooms.find((item) => item.quizId === quizId && item.status !== 'finished'));
  const clearRoom = useRoomStore((state) => state.clearRoom);
  const game = useGameStore((state) => state.games[room?.pin ?? '']);
  const gameStatus = game?.status;
  const activeRoomPin = room?.pin;
  const connectionState = useRealtimeStore((state) => state.connectionState);

  useEffect(() => {
    if (!activeRoomPin) return;
    void subscribeRoom(activeRoomPin, undefined, room?.hostToken)
      .catch((error: unknown) => useToastStore.getState().push({ variant: 'danger', title: 'Conexão com a sala indisponível', description: error instanceof Error ? error.message : 'Tente novamente.' }));
  }, [activeRoomPin, room?.hostToken]);

  useEffect(() => {
    if (quiz || !quizId) { setLoadingQuiz(false); return; }
    let current = true;
    void api.getQuiz(quizId).then((value) => { if (current) { upsertQuiz(value); setLoadingQuiz(false); } }).catch((error: unknown) => { if (current) { setLoadingQuiz(false); useToastStore.getState().push({ variant: 'danger', title: 'Quiz indisponível', description: error instanceof Error ? error.message : 'Não foi possível carregar o quiz.' }); } });
    return () => { current = false; };
  }, [quiz, quizId, upsertQuiz]);

  useEffect(() => {
    if (gameStatus && quizId) navigate(`/criar/${quizId}/partida`);
  }, [gameStatus, navigate, quizId]);

  useEffect(() => {
    if (room?.status === 'finished' && quizId) navigate(`/criar/${quizId}/revisar`);
  }, [navigate, quizId, room?.status]);

  if (!quizId || !quiz) {
    if (loadingQuiz) return <Container size="md" className="flex min-h-screen items-center justify-center"><p className="type-body text-neutral-600">Carregando quiz…</p></Container>;
    return (
      <Container size="md" className="flex min-h-screen items-center justify-center py-10">
        <Card variant="elevated" className="w-full max-w-lg">
          <CardContent className="flex flex-col items-center gap-5 p-6 text-center sm:p-8">
            <CircleHelp className="size-10 text-neutral-400" aria-hidden="true" />
            <h1 className="type-h2 text-neutral-900">Quiz não encontrado</h1>
            <p className="type-body text-neutral-600">Este quiz não está disponível neste estado local. Volte à criação para escolher um quiz.</p>
            <ButtonLink to="/criar" size="lg" className="w-full sm:w-auto"><Home className="size-4" aria-hidden="true" />Voltar para criar quiz</ButtonLink>
          </CardContent>
        </Card>
      </Container>
    );
  }

  if (!room) {
    return (
      <Container size="md" className="flex min-h-screen items-center justify-center py-10">
        <Card variant="elevated" className="w-full max-w-lg">
          <CardContent className="flex flex-col items-center gap-5 p-6 text-center sm:p-8">
            <DoorOpen className="size-10 text-neutral-400" aria-hidden="true" />
            <h1 className="type-h2 text-neutral-900">Sala não encontrada</h1>
            <p className="type-body text-neutral-600">A sala local pode ter sido encerrada ou ainda não foi criada.</p>
            <ButtonLink to={`/criar/${quizId}/revisar`} size="lg" className="w-full sm:w-auto"><ArrowLeft className="size-4" aria-hidden="true" />Voltar à revisão</ButtonLink>
          </CardContent>
        </Card>
      </Container>
    );
  }

  const categoryLabel = QUIZ_CATEGORIES.find((category) => category.value === quiz.category)?.label ?? quiz.category;
  const countLabel = `${room.players.length} ${room.players.length === 1 ? 'jogador' : 'jogadores'}`;
  const startGame = () => {
    if (room.status !== 'waiting') return;
    try { sendCommand({ type: 'START_GAME', payload: { roomPin: room.pin } }); }
    catch (error) { useToastStore.getState().push({ variant: 'danger', title: 'Não foi possível iniciar', description: error instanceof Error ? error.message : 'Verifique a conexão.' }); }
  };
  const endRoom = async () => {
    try { await closeRoomRealtime(room.pin); } catch (error) { useToastStore.getState().push({ variant: 'danger', title: 'Não foi possível encerrar a sala', description: error instanceof Error ? error.message : 'Verifique a conexão.' }); return; }
    clearRoom(room.pin);
    navigate(`/criar/${quizId}/revisar`);
  };
  const joinUrl = buildRoomJoinUrl(room.pin, window.location.origin);

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-border bg-surface">
        <Container size="xl" className="flex min-h-16 items-center justify-between gap-3 py-2">
          <Logo />
          <Button variant="outline" size="sm" onClick={() => setConfirmClose(true)}><DoorOpen className="size-4" aria-hidden="true" />Encerrar sala</Button>
        </Container>
      </header>

      <main>
        <Container size="xl" className="py-8 sm:py-12">
          <div className="mb-4"><RealtimeConnectionNotice /></div>
          <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-primary-800 via-primary-700 to-accent-700 px-5 py-10 text-center text-white shadow-lg sm:px-10 sm:py-14">
            <Badge variant="success" className="mb-4">Sala pronta</Badge>
            <h1 className="type-h1 text-white">Sua sala está pronta</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm text-white/85 sm:text-base">Compartilhe o PIN com os jogadores para que entrem na sala.</p>
            <div className="mx-auto mt-8 w-fit rounded-2xl border border-border-strong bg-neutral-100 px-3 py-3 text-neutral-900 shadow-xl sm:px-8 sm:py-5">
              <GamePin pin={room.pin} size="lg" />
            </div>
            <p className="mt-5 text-sm font-medium text-white/80">Digite o código em quizseplag para participar</p>
          </section>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <Card variant="elevated">
              <CardHeader className="flex-row items-center justify-between gap-3">
                <div><CardTitle className="type-h3">Jogadores</CardTitle><p className="type-body-sm mt-1 text-neutral-500">Participantes conectados à sala</p></div>
                <PlayerCount count={room.players.length} label="jogadores" />
              </CardHeader>
              <CardContent>
                {room.players.length === 0 ? (
                  <EmptyState icon={<Users className="size-6" />} title="Nenhum jogador entrou ainda" description="Compartilhe o PIN da sala para que os participantes entrem." className="py-10" />
                ) : (
                  <ul aria-label="Lista de jogadores" className="flex flex-col gap-2">
                    {room.players.map((player) => <li key={player.id} className="rounded-lg border border-border p-3">{player.name}</li>)}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card variant="elevated">
              <CardHeader className="flex-row items-start justify-between gap-3">
                <div className="min-w-0"><CardTitle className="type-h3">{quiz.title}</CardTitle><p className="type-body-sm mt-1 text-neutral-500">Detalhes do quiz</p></div>
                <GameStatus status={room.status === 'in-progress' ? 'playing' : room.status} />
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <Badge variant="primary" className="w-fit">{categoryLabel}</Badge>
                {quiz.description && <p className="type-body-sm text-neutral-600">{quiz.description}</p>}
                <div className="rounded-xl bg-neutral-50 p-4"><p className="type-caption text-neutral-500">Perguntas</p><p className="type-h3 text-neutral-900">{quiz.questions.length}</p></div>
                <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-white p-4 text-center">
                  <QRCodeSVG value={joinUrl} size={176} level="M" title={`QR Code para entrar na sala ${room.pin}`} />
                  <p className="type-label text-neutral-700">Leia para entrar na sala</p>
                  <p className="type-caption max-w-xs break-all text-neutral-500">{joinUrl}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <section className="mx-auto mt-8 flex max-w-2xl flex-col items-center gap-3 text-center">
            {room.status === 'waiting' ? (
              <>
                <Button size="lg" className="w-full sm:w-auto sm:min-w-64" onClick={startGame} disabled={connectionState !== 'synced'}>
                  <Play className="size-5" aria-hidden="true" />Iniciar partida
                </Button>
                <p className="type-caption text-neutral-500" aria-live="polite">{countLabel} na sala</p>
              </>
            ) : (
              <ButtonLink to={`/criar/${quizId}/partida`} size="lg">Abrir partida</ButtonLink>
            )}
          </section>
        </Container>
      </main>

      <Modal open={confirmClose} onClose={() => setConfirmClose(false)} title="Encerrar esta sala?" description="Os jogadores serão removidos da sala e o lobby será encerrado." actions={<><Button variant="outline" onClick={() => setConfirmClose(false)}>Cancelar</Button><Button variant="danger" onClick={endRoom}>Encerrar sala</Button></>}>
        <p className="type-body-sm text-neutral-600">Esta ação remove a sala do estado local atual.</p>
      </Modal>
    </div>
  );
}
