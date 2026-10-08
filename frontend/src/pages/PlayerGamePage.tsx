import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Home, Trophy } from 'lucide-react';
import { Container } from '@/components/layout/Container';
import { Logo } from '@/components/layout/Logo';
import { QuizQuestion } from '@/components/quiz/QuizQuestion';
import { QuizOption } from '@/components/quiz/QuizOption';
import { RevealGate } from '@/components/quiz/RevealGate';
import { Timer } from '@/components/quiz/Timer';
import { GameProgress } from '@/components/game/GameProgress';
import { GameStatus } from '@/components/game/GameStatus';
import { RankingList } from '@/components/game/RankingList';
import { FinalPodium } from '@/components/game/FinalPodium';
import { Button } from '@/components/ui/Button';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { Card, CardContent } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { EmptyState } from '@/components/ui/EmptyState';
import { useGameStore } from '@/stores/gameStore';
import { usePlayerStore } from '@/stores/playerStore';
import { subscribeRoom, submitAnswerRealtime } from '@/services/realtime/session';
import { useRealtimeStore } from '@/stores/realtimeStore';
import { RealtimeConnectionNotice } from '@/components/game/RealtimeConnectionNotice';
import { useToastStore } from '@/components/ui/useToastStore';

export function PlayerGamePage() {
  const { pin = '' } = useParams<{ pin: string }>();
  const navigate = useNavigate();
  const game = useGameStore((state) => state.games[pin]);
  const selectOption = useGameStore((state) => state.selectOption);
  const player = usePlayerStore();
  const connectionState = useRealtimeStore((state) => state.connectionState);
  const sessionRoomPin = useRealtimeStore((state) => state.roomPin);
  const sessionPlayerId = useRealtimeStore((state) => state.playerId);
  const [sending, setSending] = useState(false);
  const focusRef = useRef<HTMLDivElement>(null);
  const question = game?.currentQuestion;

  useEffect(() => {
    if (!player.playerId || player.roomPin !== pin) return;
    void subscribeRoom(pin, player.playerId, undefined, player.playerToken).catch((error: unknown) => useToastStore.getState().push({ variant: 'danger', title: 'Não foi possível sincronizar a partida', description: error instanceof Error ? error.message : 'Verifique a conexão.' }));
  }, [pin, player.playerId, player.playerToken, player.roomPin]);

  useEffect(() => { focusRef.current?.focus(); }, [game?.status, question?.questionIndex]);

  const sendAnswer = async () => {
    if (!game?.currentQuestionId || !game.selectedOptionId || !player.playerId || sending || game.answerStatus === 'submitted') return;
    setSending(true);
    try {
      await submitAnswerRealtime(pin, game.currentQuestionId, game.selectedOptionId);
    } catch (error) {
      useToastStore.getState().push({ variant: 'danger', title: 'Resposta não registrada', description: error instanceof Error ? error.message : 'Tente novamente.' });
    } finally { setSending(false); }
  };

  if (!player.playerId || player.roomPin !== pin) return <StateCard title="Sessão do jogador não encontrada" description="Entre na sala novamente para participar desta partida." action={<ButtonLink to={`/jogar/${pin}`} size="lg">Entrar na sala</ButtonLink>} />;
  if (connectionState !== 'synced' || sessionRoomPin !== pin || sessionPlayerId !== player.playerId) return <StateCard title="Atualizando a sala" description="Aguarde um instante para ver o estado atual da partida." action={<RealtimeConnectionNotice />} />;
  if (!game || game.status === 'waiting') return <StateCard title="Aguardando a partida" description="A pergunta aparecerá aqui quando o anfitrião iniciar a partida." action={<ButtonLink to={`/jogar/${pin}/aguardando`} size="lg">Voltar ao lobby</ButtonLink>} />;

  if (game.status === 'finished') return (
    <Container size="lg" className="flex min-h-screen flex-col items-center justify-center gap-6 py-8 sm:py-12">
      <div className="w-full text-center"><Trophy className="mx-auto mb-3 size-10 text-warning-500" aria-hidden="true" /><p className="type-caption font-semibold uppercase tracking-widest text-primary-800">Quiz SEPLAG</p><h1 className="type-h2 mt-1 text-neutral-900">Partida encerrada</h1></div>
      <FinalPodium entries={game.ranking} animate={game.finalPresentation === 'animate'} />
      {(() => {
        const own = game.ranking.find((entry) => entry.playerId === player.playerId);
        if (!own) return null;
        return <Card variant="elevated" className="w-full max-w-2xl"><CardContent className="flex flex-col items-center gap-1 p-5 text-center sm:p-6">
          <p className="type-caption font-semibold uppercase tracking-widest text-neutral-500">Sua posição</p>
          <p className="type-h3 text-neutral-900">{own.position === 1 ? 'Você venceu!' : `Você terminou em ${own.position}º lugar`}</p>
          <p className="type-body text-neutral-700">{own.playerName} · <strong>{own.score.toLocaleString('pt-BR')} pontos</strong></p>
        </CardContent></Card>;
      })()}
      <Button size="lg" onClick={() => navigate('/')}><Home className="size-4" aria-hidden="true" />Voltar ao início</Button>
    </Container>
  );
  if (!question) return <StateCard title="Preparando pergunta" description="A pergunta aparecerá aqui em instantes." action={<ButtonLink to={`/jogar/${pin}/aguardando`} size="lg">Voltar ao lobby</ButtonLink>} />;

  const optionsDisabled = connectionState !== 'synced' || game.status !== 'question' || game.answerStatus === 'submitted' || sending;
  const submitDisabled = optionsDisabled || !game.selectedOptionId;
  const labels = ['A', 'B', 'C', 'D'];
  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-border bg-surface"><Container size="lg" className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center justify-between gap-3"><Logo /><span className="type-caption text-neutral-500 sm:hidden">PIN {pin}</span></div><div className="flex min-w-0 items-center gap-4 sm:w-2/3"><GameProgress current={game.currentQuestionIndex + 1} total={game.totalQuestions} /><GameStatus status={game.status} /></div></Container></header>
      <main><Container size="md" className="py-6 sm:py-10"><div className="mb-4"><RealtimeConnectionNotice /></div>
        <div className="mb-6 flex items-center justify-between gap-4"><div><p className="type-caption text-neutral-500">Sala · PIN {pin}</p><h1 className="type-h3 text-neutral-900">Quiz SEPLAG</h1></div>{game.status === 'question' && game.endsAt !== null && <Timer key={`${pin}-${question.questionId}`} duration={question.timeLimit} endsAt={Date.parse(question.questionEndsAt)} size="md" onExpire={() => undefined} />}</div>
        <Card variant="elevated" className="overflow-hidden"><CardContent className="flex flex-col gap-7 p-5 sm:gap-8 sm:p-8">
          {game.status === 'results' ? (
            <section ref={focusRef} tabIndex={-1} aria-live="polite" className="flex flex-col gap-6 rounded-2xl bg-primary-50 p-5 text-white focus:outline-2 focus:outline-offset-4 focus:outline-primary-500 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="type-caption font-bold uppercase tracking-widest text-primary-800">Pergunta {game.currentQuestionIndex + 1} concluída</p><h2 className="type-h2 mt-1 text-white">🏆 Ranking</h2></div>{game.resultsEndsAt && <Timer duration={3} endsAt={Date.parse(game.resultsEndsAt)} label="Próxima pergunta em" size="sm" tone="dark" />}</div>
              <RankingList entries={game.ranking} highlightPlayerId={player.playerId} />
              <div className="rounded-xl bg-white/10 p-4 text-center"><p className="type-body-sm text-primary-800">Sua posição</p><p className="type-h2 mt-1 text-white">{game.ranking.find((entry) => entry.playerId === player.playerId)?.position ?? '—'}º</p><p className="type-body-sm mt-2 text-primary-800">Próxima pergunta em breve…</p></div>
            </section>
          ) : <>
            <div ref={focusRef} tabIndex={-1} className="rounded-md focus:outline-2 focus:outline-offset-4 focus:outline-primary-500"><QuizQuestion index={game.currentQuestionIndex + 1} total={game.totalQuestions} question={question.text} imageUrl={question.imageUrl} /></div>
            <RevealGate key={`${question.questionId}-${question.questionRevealAt}`} revealAt={question.questionRevealAt}><div role="group" aria-label="Alternativas de resposta" className="grid gap-3">{question.options.map((option, index) => <QuizOption key={option.id} label={labels[index] ?? String(index + 1)} text={option.text} imageUrl={option.imageUrl} selected={game.selectedOptionId === option.id} state={game.selectedOptionId === option.id ? 'selected' : 'default'} disabled={optionsDisabled} onSelect={() => selectOption(pin, option.id)} />)}</div></RevealGate>
            {game.answerStatus === 'submitted' && <Alert variant="success" title="Resposta registrada">Sua resposta foi salva.</Alert>}
            <Button size="lg" className="w-full" onClick={() => void sendAnswer()} disabled={submitDisabled}>{sending ? 'Enviando…' : game.answerStatus === 'submitted' ? 'Resposta enviada' : 'Responder'}</Button>
            <p className="type-caption text-center text-neutral-500">Sua pontuação é calculada automaticamente ao longo da partida.</p>
          </>}
        </CardContent></Card>
      </Container></main>
    </div>
  );
}

function StateCard({ title, description, action }: { title: string; description: string; action: React.ReactNode }) {
  return <Container size="md" className="flex min-h-screen items-center justify-center py-10"><Card variant="elevated" className="w-full max-w-lg"><CardContent className="flex flex-col items-center gap-5 p-6 text-center sm:p-8"><EmptyState title={title} description={description} />{action}</CardContent></Card></Container>;
}
