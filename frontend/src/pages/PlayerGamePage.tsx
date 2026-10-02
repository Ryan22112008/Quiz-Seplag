import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Home, Trophy } from 'lucide-react';
import { Container } from '@/components/layout/Container';
import { Logo } from '@/components/layout/Logo';
import { QuizQuestion } from '@/components/quiz/QuizQuestion';
import { QuizOption } from '@/components/quiz/QuizOption';
import { Timer } from '@/components/quiz/Timer';
import { GameProgress } from '@/components/game/GameProgress';
import { GameStatus } from '@/components/game/GameStatus';
import { RankingList } from '@/components/game/RankingList';
import { Button } from '@/components/ui/Button';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { Card, CardContent } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { EmptyState } from '@/components/ui/EmptyState';
import { useGameStore } from '@/stores/gameStore';
import { usePlayerStore } from '@/stores/playerStore';
import { api } from '@/services/api/client';
import { useToastStore } from '@/components/ui/useToastStore';

export function PlayerGamePage() {
  const { pin = '' } = useParams<{ pin: string }>();
  const navigate = useNavigate();
  const game = useGameStore((state) => state.games[pin]);
  const selectOption = useGameStore((state) => state.selectOption);
  const applyAnswerFeedback = useGameStore((state) => state.applyAnswerFeedback);
  const player = usePlayerStore();
  const [sending, setSending] = useState(false);
  const [timerExpired, setTimerExpired] = useState(false);
  const focusRef = useRef<HTMLDivElement>(null);
  const question = game?.currentQuestion;

  useEffect(() => { setTimerExpired(false); }, [question?.questionId]);
  useEffect(() => { focusRef.current?.focus(); }, [game?.status, question?.questionIndex]);

  const sendAnswer = async () => {
    if (!game?.currentQuestionId || !game.selectedOptionId || !player.playerId || sending || game.answerStatus === 'submitted' || timerExpired) return;
    setSending(true);
    try {
      const result = await api.submitAnswer(pin, player.playerId, game.currentQuestionId, game.selectedOptionId);
      applyAnswerFeedback(pin, { isCorrect: result.isCorrect, points: result.points, totalScore: result.totalScore });
    } catch (error) {
      useToastStore.getState().push({ variant: 'danger', title: 'Resposta não registrada', description: error instanceof Error ? error.message : 'Tente novamente.' });
    } finally { setSending(false); }
  };

  if (!player.playerId || player.roomPin !== pin) return <StateCard title="Sessão do jogador não encontrada" description="Entre na sala novamente para participar desta partida." action={<ButtonLink to={`/jogar/${pin}`} size="lg">Entrar na sala</ButtonLink>} />;
  if (!game || game.status === 'waiting') return <StateCard title="Aguardando a partida" description="A pergunta aparecerá aqui quando o anfitrião iniciar a partida." action={<ButtonLink to={`/jogar/${pin}/aguardando`} size="lg">Voltar ao lobby</ButtonLink>} />;

  if (game.status === 'finished') return (
    <Container size="md" className="flex min-h-screen items-center justify-center py-10">
      <Card variant="elevated" className="w-full max-w-xl"><CardContent className="p-6 text-center sm:p-8">
        <div className="flex flex-col items-center gap-5"><Trophy className="size-12 text-warning-500" aria-hidden="true" /><h1 className="type-h2 text-neutral-900">Partida encerrada</h1><h2 className="type-h3 text-neutral-700">Resultado final</h2>
          <div className="grid w-full grid-cols-2 gap-4 rounded-xl bg-neutral-50 p-4"><p className="type-body text-neutral-700">Pontuação: <strong>{game.finalResult?.score ?? '—'}</strong></p><p className="type-body text-neutral-700">Posição: <strong>{game.finalResult?.position !== undefined ? `#${game.finalResult.position}` : '—'}</strong></p></div>
          <RankingList entries={game.ranking} /><Button size="lg" onClick={() => navigate('/')}><Home className="size-4" aria-hidden="true" />Voltar ao início</Button>
        </div>
      </CardContent></Card>
    </Container>
  );
  if (!question) return <StateCard title="Preparando pergunta" description="Aguardando o servidor enviar a pergunta atual." action={<ButtonLink to={`/jogar/${pin}/aguardando`} size="lg">Voltar ao lobby</ButtonLink>} />;

  const disabled = game.status !== 'question' || game.answerStatus === 'submitted' || !game.selectedOptionId || timerExpired || sending;
  const labels = ['A', 'B', 'C', 'D'];
  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-border bg-surface"><Container size="lg" className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center justify-between gap-3"><Logo /><span className="type-caption text-neutral-500 sm:hidden">PIN {pin}</span></div><div className="flex min-w-0 items-center gap-4 sm:w-2/3"><GameProgress current={game.currentQuestionIndex + 1} total={game.totalQuestions} /><GameStatus status={game.status} /></div></Container></header>
      <main><Container size="md" className="py-6 sm:py-10">
        <div className="mb-6 flex items-center justify-between gap-4"><div><p className="type-caption text-neutral-500">Sala · PIN {pin}</p><h1 className="type-h3 text-neutral-900">Quiz SEPLAG</h1></div>{game.status === 'question' && game.endsAt !== null && <Timer key={`${pin}-${question.questionId}`} duration={question.timeLimit} endsAt={Date.parse(question.questionEndsAt)} size="md" onExpire={() => setTimerExpired(true)} />}</div>
        <Card variant="elevated" className="overflow-hidden"><CardContent className="flex flex-col gap-7 p-5 sm:gap-8 sm:p-8">
          <div ref={focusRef} tabIndex={-1} className="rounded-md focus:outline-2 focus:outline-offset-4 focus:outline-primary-500"><QuizQuestion index={game.currentQuestionIndex + 1} total={game.totalQuestions} question={question.text} /></div>
          <div role="group" aria-label="Alternativas de resposta" className="grid gap-3">{question.options.map((option, index) => <QuizOption key={option.id} label={labels[index] ?? String(index + 1)} text={option.text} selected={game.selectedOptionId === option.id} state={game.selectedOptionId === option.id ? 'selected' : 'default'} disabled={disabled} onSelect={() => selectOption(pin, option.id)} />)}</div>
          {game.answerFeedback && <Alert variant={game.answerFeedback.isCorrect ? 'success' : 'info'} title={game.answerFeedback.isCorrect ? 'Resposta correta' : 'Resposta registrada'}>{game.answerFeedback.isCorrect ? `+${game.answerFeedback.points} pontos · total ${game.answerFeedback.totalScore}` : `0 pontos · total ${game.answerFeedback.totalScore}`}</Alert>}
          {timerExpired && game.answerStatus !== 'submitted' && <Alert variant="warning" title="Tempo encerrado">O prazo para responder acabou.</Alert>}
          {game.status === 'results' && <RankingList entries={game.ranking} />}
          <Button size="lg" className="w-full" onClick={() => void sendAnswer()} disabled={disabled}>{sending ? 'Enviando…' : game.answerStatus === 'submitted' ? 'Resposta enviada' : 'Responder'}</Button>
          <p className="type-caption text-center text-neutral-500">A pontuação oficial é calculada pelo servidor.</p>
        </CardContent></Card>
      </Container></main>
    </div>
  );
}

function StateCard({ title, description, action }: { title: string; description: string; action: React.ReactNode }) {
  return <Container size="md" className="flex min-h-screen items-center justify-center py-10"><Card variant="elevated" className="w-full max-w-lg"><CardContent className="flex flex-col items-center gap-5 p-6 text-center sm:p-8"><EmptyState title={title} description={description} />{action}</CardContent></Card></Container>;
}
