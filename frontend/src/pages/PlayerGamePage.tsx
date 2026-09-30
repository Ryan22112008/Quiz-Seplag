import { useCallback, useEffect, useRef } from 'react';
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
import { Spinner } from '@/components/ui/Spinner';
import { useQuizStore } from '@/stores/quizStore';
import { useRoomStore } from '@/stores/roomStore';
import { useGameStore } from '@/stores/gameStore';
import { usePlayerStore } from '@/stores/playerStore';

export function PlayerGamePage() {
  const { pin = '' } = useParams<{ pin: string }>();
  const navigate = useNavigate();
  const room = useRoomStore((state) => state.getRoom(pin));
  const quiz = useQuizStore((state) => room ? state.getQuizById(room.quizId) : undefined);
  const game = useGameStore((state) => state.games[pin]);
  const selectOption = useGameStore((state) => state.selectOption);
  const submitAnswer = useGameStore((state) => state.submitAnswer);
  const lockQuestion = useGameStore((state) => state.lockQuestion);
  const resetGame = useGameStore((state) => state.resetGame);
  const clearPlayer = usePlayerStore((state) => state.clearPlayer);
  const focusRegionRef = useRef<HTMLDivElement>(null);
  const handleExpire = useCallback(() => lockQuestion(pin, true), [lockQuestion, pin]);
  const gameStatus = game?.status;
  const questionIndex = game?.currentQuestionIndex;

  useEffect(() => {
    if (gameStatus === 'question' || gameStatus === 'locked' || gameStatus === 'results' || gameStatus === 'finished') {
      focusRegionRef.current?.focus();
    }
  }, [gameStatus, questionIndex]);

  // Select only public question fields. The player view never reads correctOptionId from quizStore.
  const sourceQuestion = quiz?.questions[game?.currentQuestionIndex ?? -1];
  const question = sourceQuestion ? {
    question: sourceQuestion.question,
    options: sourceQuestion.options,
    timeLimit: sourceQuestion.timeLimit,
    points: sourceQuestion.points,
  } : undefined;

  if (!room || !quiz || !game) {
    return <StateCard title="Partida não encontrada" description="O PIN, o quiz ou o estado da partida não está disponível neste dispositivo. Salas locais não são compartilhadas entre dispositivos." action={<ButtonLink to="/" size="lg"><Home className="size-4" aria-hidden="true" />Voltar ao início</ButtonLink>} />;
  }

  if (game.status === 'waiting' || !question) {
    return <StateCard title={game.status === 'waiting' ? 'Preparando pergunta...' : 'Partida não encontrada'} description={game.status === 'waiting' ? 'A pergunta ainda não foi iniciada.' : 'Não foi possível encontrar esta pergunta no quiz.'} action={<ButtonLink to="/" size="lg"><Home className="size-4" aria-hidden="true" />Voltar ao início</ButtonLink>} />;
  }

  const optionLabels = ['A', 'B', 'C', 'D'];
  const resultsVisible = game.status === 'results';
  const locked = game.status !== 'question' || game.answerStatus === 'submitted';
  const correctOptionId = resultsVisible ? game.questionResult?.correctOptionId : undefined;
  const leaveForHome = () => {
    navigate('/');
    resetGame(pin);
    clearPlayer();
  };

  if (game.status === 'finished') {
    return (
      <Container size="md" className="flex min-h-screen items-center justify-center py-10">
        <Card variant="elevated" className="w-full max-w-xl">
          <CardContent className="p-6 text-center sm:p-8">
            <div ref={focusRegionRef} tabIndex={-1} className="flex flex-col items-center gap-5 focus:outline-none">
            <Trophy className="size-12 text-warning-500" aria-hidden="true" />
            <h1 className="type-h2 text-neutral-900">Partida encerrada</h1>
            <h2 className="type-h3 text-neutral-700">Resultado final</h2>
            <div role="status" aria-live="polite" className="w-full rounded-xl bg-neutral-50 p-4">
              <div className="grid grid-cols-2 gap-4">
                <p className="type-body text-neutral-700">Pontuação: <strong>{game.finalResult?.score ?? '—'}</strong></p>
                <p className="type-body text-neutral-700">Posição: <strong>{game.finalResult?.position !== undefined ? `#${game.finalResult.position}` : '—'}</strong></p>
              </div>
              {!game.finalResult && <div className="mt-4 flex flex-col items-center gap-2"><Spinner label="Aguardando resultado final" /><p className="type-body-sm text-neutral-600">Aguardando resultado...</p></div>}
            </div>
            <RankingList entries={game.ranking} />
            <Button size="lg" className="w-full sm:w-auto" onClick={leaveForHome}><Home className="size-4" aria-hidden="true" />Voltar ao início</Button>
            </div>
          </CardContent>
        </Card>
      </Container>
    );
  }

  const result = resultsVisible ? game.questionResult : null;
  const outcome = result?.correct === true ? 'Resposta correta' : result?.correct === false ? 'Resposta incorreta' : null;

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-border bg-surface">
        <Container size="lg" className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-between gap-3"><Logo /><span className="type-caption text-neutral-500 sm:hidden">PIN {pin}</span></div>
          <div className="flex min-w-0 items-center gap-4 sm:w-2/3"><GameProgress current={game.currentQuestionIndex + 1} total={game.totalQuestions} /><GameStatus status={game.status} /></div>
        </Container>
      </header>

      <main>
        <Container size="md" className="py-6 sm:py-10">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div><p className="type-caption text-neutral-500">Sala local · PIN {pin}</p><h1 className="type-h3 text-neutral-900">{quiz.title}</h1></div>
            {game.status === 'question' && game.endsAt !== null && <Timer key={`${pin}-${game.currentQuestionIndex}`} duration={question.timeLimit} endsAt={game.endsAt} size="md" onExpire={handleExpire} />}
          </div>

          <Card variant="elevated" className="overflow-hidden">
            <CardContent className="flex flex-col gap-7 p-5 sm:gap-8 sm:p-8">
              <div ref={focusRegionRef} tabIndex={-1} className="rounded-md focus:outline-2 focus:outline-offset-4 focus:outline-primary-500">
                <QuizQuestion index={game.currentQuestionIndex + 1} total={game.totalQuestions} question={question.question} points={question.points} />
              </div>
              <div role="group" aria-label="Alternativas de resposta" className="grid gap-3">
                {question.options.map((option, index) => {
                  const isSelected = game.selectedOptionId === option.id;
                  let state: 'default' | 'selected' | 'correct' | 'incorrect' = isSelected ? 'selected' : 'default';
                  if (resultsVisible && correctOptionId === option.id) state = 'correct';
                  else if (resultsVisible && isSelected && result?.correct === false) state = 'incorrect';
                  return <QuizOption key={option.id} label={optionLabels[index] ?? String(index + 1)} text={option.text} selected={isSelected} state={state} disabled={locked} onSelect={() => selectOption(pin, option.id)} />;
                })}
              </div>
              {resultsVisible && game.selectedOptionId && !result && <p role="status" className="type-caption rounded-lg bg-primary-50 p-3 text-center text-primary-800">Alternativa enviada · aguardando confirmação do resultado.</p>}

              <div ref={resultsVisible || game.status === 'locked' ? focusRegionRef : undefined} tabIndex={resultsVisible || game.status === 'locked' ? -1 : undefined} className="flex flex-col gap-3 focus:outline-none" aria-live="polite">
                {game.answerTimedOut && <Alert variant="warning" title="Tempo encerrado">Você não enviou uma resposta antes do fim do tempo.</Alert>}
                {game.answerStatus === 'submitted' && game.status !== 'results' && <Alert variant="info" title="Resposta enviada">A resposta foi registrada neste estado local. Aguardando o resultado.</Alert>}
                {game.status === 'locked' && <ResultWaiting />}
                {resultsVisible && result && (
                  <Alert variant={result.correct === true ? 'success' : result.correct === false ? 'danger' : 'info'} title={outcome ?? 'Resultado da pergunta'}>
                    {result.correct === true && result.points !== undefined ? `+${result.points} pts` : null}
                    {result.correct === false && result.points !== undefined ? '0 pts' : null}
                    {result.correct === undefined && 'A pergunta foi encerrada.'}
                  </Alert>
                )}
                {resultsVisible && !result && <ResultWaiting />}
                {resultsVisible && <RankingList entries={game.ranking} />}
              </div>

              {game.status === 'question' ? (
                <Button size="lg" className="w-full" onClick={() => submitAnswer(pin)} disabled={game.answerStatus !== 'selected'}>
                  {game.answerStatus === 'submitted' ? 'Resposta enviada' : 'Responder'}
                </Button>
              ) : <Button variant="outline" size="lg" className="w-full" disabled>Aguardar próxima pergunta</Button>}
              <p className="type-caption text-center text-neutral-500">Estado local · sem sincronização com outros dispositivos</p>
            </CardContent>
          </Card>
        </Container>
      </main>
    </div>
  );
}

function ResultWaiting() {
  return <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface p-4 text-center" role="status" aria-live="polite"><Spinner label="Aguardando resultado" /><p className="type-label text-neutral-800">Aguardando resultado...</p><p className="type-caption text-neutral-500">Resultado aguardando dados do servidor.</p></div>;
}

function StateCard({ title, description, action }: { title: string; description: string; action: React.ReactNode }) {
  return <Container size="md" className="flex min-h-screen items-center justify-center py-10"><Card variant="elevated" className="w-full max-w-lg"><CardContent className="flex flex-col items-center gap-5 p-6 text-center sm:p-8"><EmptyState title={title} description={description} />{action}</CardContent></Card></Container>;
}
