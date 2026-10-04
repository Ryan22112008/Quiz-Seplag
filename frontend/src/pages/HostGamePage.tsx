import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, DoorOpen, Flag, Home, Users } from 'lucide-react';
import { Container } from '@/components/layout/Container';
import { Logo } from '@/components/layout/Logo';
import { GameProgress } from '@/components/game/GameProgress';
import { GameStatus } from '@/components/game/GameStatus';
import { RankingList } from '@/components/game/RankingList';
import { QuizQuestion } from '@/components/quiz/QuizQuestion';
import { Timer } from '@/components/quiz/Timer';
import { Button } from '@/components/ui/Button';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { useQuizStore } from '@/stores/quizStore';
import { useRoomStore } from '@/stores/roomStore';
import { useGameStore } from '@/stores/gameStore';
import { sendCommand, subscribeRoom } from '@/services/realtime/session';
import { api } from '@/services/api/client';
import { useToastStore } from '@/components/ui/useToastStore';
import { RealtimeConnectionNotice } from '@/components/game/RealtimeConnectionNotice';
import { useRealtimeStore } from '@/stores/realtimeStore';

export function HostGamePage() {
  const { quizId = '' } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const [confirmEnd, setConfirmEnd] = useState(false);
  const quiz = useQuizStore((state) => state.getQuizById(quizId));
  const upsertQuiz = useQuizStore((state) => state.upsertQuiz);
  const [loadingQuiz, setLoadingQuiz] = useState(Boolean(quizId && !quiz));
  const room = useRoomStore((state) => state.rooms.find((item) => item.quizId === quizId));
  const game = useGameStore((state) => room ? state.games[room.pin] : undefined);
  const phaseRef = useRef<HTMLDivElement>(null);
  const gameStatus = game?.status;
  const activeRoomPin = room?.pin;
  const connectionState = useRealtimeStore((state) => state.connectionState);

  useEffect(() => {
    if (!activeRoomPin) return;
    void subscribeRoom(activeRoomPin, undefined, room?.hostToken).catch((error: unknown) => useToastStore.getState().push({ variant: 'danger', title: 'Não foi possível sincronizar a partida', description: error instanceof Error ? error.message : 'Verifique a conexão.' }));
  }, [activeRoomPin, room?.hostToken]);

  useEffect(() => {
    if (quiz || !quizId) { setLoadingQuiz(false); return; }
    if (!room?.pin || !room.hostToken) { setLoadingQuiz(false); return; }
    let current = true;
    void api.getHostQuiz(room.pin, room.hostToken).then((value) => { if (current) { upsertQuiz(value); setLoadingQuiz(false); } }).catch((error: unknown) => { if (current) { setLoadingQuiz(false); useToastStore.getState().push({ variant: 'danger', title: 'Quiz indisponível', description: error instanceof Error ? error.message : 'Não foi possível carregar o quiz.' }); } });
    return () => { current = false; };
  }, [quiz, quizId, room?.pin, room?.hostToken, upsertQuiz]);

  useEffect(() => {
    if (gameStatus === 'locked' || gameStatus === 'results' || gameStatus === 'finished') phaseRef.current?.focus();
  }, [gameStatus, game?.currentQuestionIndex]);

  if (!quiz || !room) {
    if (loadingQuiz) return <Container size="md" className="flex min-h-screen items-center justify-center"><Spinner label="Carregando quiz" /></Container>;
    return <HostState title="Partida não encontrada" description="O quiz, a sala ou o estado da partida não está disponível neste dispositivo." action={<ButtonLink to="/" size="lg"><Home className="size-4" aria-hidden="true" />Voltar ao início</ButtonLink>} />;
  }
  if (!game) return <Container size="md" className="flex min-h-screen items-center justify-center"><div className="flex flex-col items-center gap-3"><Spinner label="Carregando resultado" /><p className="type-body text-neutral-600">Carregando resultado...</p></div></Container>;

  const sourceQuestion = quiz.questions[game.currentQuestionIndex];
  const question = game.currentQuestion && sourceQuestion ? { ...sourceQuestion, id: game.currentQuestion.questionId, question: game.currentQuestion.text, options: game.currentQuestion.options } : undefined;
  const lastQuestion = game.currentQuestionIndex === game.totalQuestions - 1;
  const phase = game.status;
  const leaveToReview = () => { navigate(`/criar/${quizId}/revisar`); };
  const leaveToHome = () => { navigate('/'); };
  const endGame = () => {
    try { sendCommand({ type: 'FINISH_GAME', payload: { roomPin: room.pin } }); }
    catch (error) { useToastStore.getState().push({ variant: 'danger', title: 'Não foi possível encerrar a partida', description: error instanceof Error ? error.message : 'Verifique a conexão.' }); }
    setConfirmEnd(false);
  };
  const next = () => {
    try { sendCommand({ type: 'NEXT_QUESTION', payload: { roomPin: room.pin } }); }
    catch (error) { useToastStore.getState().push({ variant: 'danger', title: 'Não foi possível avançar', description: error instanceof Error ? error.message : 'Verifique a conexão.' }); }
  };

  if (game.status === 'finished') {
    return (
      <div className="min-h-screen bg-neutral-50">
        <header className="border-b border-border bg-surface"><Container size="xl" className="flex min-h-16 items-center justify-between gap-3"><Logo /><GameStatus status="finished" /></Container></header>
        <main><Container size="xl" className="py-8 sm:py-10">
          <div ref={phaseRef} tabIndex={-1} className="mb-6 text-center focus:outline-none"><h1 className="type-h1 text-neutral-900">Partida encerrada</h1><p className="type-body mt-2 text-neutral-600">Resultado final do quiz {quiz.title}</p></div>
          {!game.finalResult && <div className="mb-6 flex flex-col items-center gap-2" role="status" aria-live="polite"><span className="type-label text-neutral-700">Aguardando resultado...</span><p className="type-caption text-neutral-500">Os dados finais ainda não foram recebidos.</p></div>}
          <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
            <Card variant="elevated"><CardHeader><CardTitle>Estatísticas da partida</CardTitle></CardHeader><CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <StatCard label="Total de jogadores" value={room.players.length} />
              <StatCard label="Total de respostas" value={game.finalStatistics?.totalAnswers ?? '—'} />
              <StatCard label="Perguntas" value={quiz.questions.length} />
              <StatCard label="Taxa de acerto" value={game.finalStatistics?.accuracyRate !== undefined ? `${game.finalStatistics.accuracyRate}%` : '—'} />
              <StatCard label="Pontuação máxima" value={game.finalStatistics?.highestScore ?? '—'} />
            </CardContent></Card>
            <Card variant="elevated"><CardHeader><CardTitle>Ranking final</CardTitle></CardHeader><CardContent><RankingList entries={game.ranking} /></CardContent></Card>
          </div>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" onClick={leaveToReview}><Home className="size-4" aria-hidden="true" />Revisar quiz</Button>
            <Button variant="outline" size="lg" onClick={leaveToHome}>Voltar ao início</Button>
          </div>
        </Container></main>
      </div>
    );
  }

  if (!question && game.status !== 'waiting') {
    return <HostState title="Quiz sem perguntas" description="Adicione perguntas ao quiz antes de iniciar uma partida." action={<ButtonLink to={`/criar/${quizId}/perguntas`} size="lg">Editar perguntas</ButtonLink>} />;
  }

  if (!question) return <Container size="md" className="flex min-h-screen items-center justify-center"><Spinner label="Aguardando pergunta" /></Container>;
  const questionResultVisible = game.status === 'results';
  const correctOptionId = questionResultVisible ? game.questionResult?.correctOptionId ?? question.correctOptionId : undefined;
  const optionLabels = ['A', 'B', 'C', 'D'];
  const disabledReason = game.status === 'question' ? 'Aguarde o servidor confirmar o fim da pergunta.' : 'Aguarde a próxima pergunta.';

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-border bg-surface">
        <Container size="xl" className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-between gap-3"><Logo /><Badge variant="primary">Anfitrião</Badge></div>
          <div className="flex items-center gap-4 sm:w-1/2"><GameProgress current={game.currentQuestionIndex + 1} total={game.totalQuestions} />{game.status === 'question' && game.endsAt !== null && <Timer key={`${room.pin}-${game.currentQuestionIndex}`} duration={question.timeLimit} endsAt={game.endsAt} size="sm" onExpire={() => undefined} />}</div>
        </Container>
      </header>

      <main>
        <Container size="xl" className="py-6 sm:py-10">
          <div className="mb-4"><RealtimeConnectionNotice /></div>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div><p className="type-caption text-neutral-500">PIN {room.pin} · Pergunta {game.currentQuestionIndex + 1} de {game.totalQuestions}</p><h1 className="type-h2 text-neutral-900">{quiz.title}</h1></div>
            <div className="flex items-center gap-3"><GameStatus status={phase} /><Button variant="outline" onClick={() => setConfirmEnd(true)}><DoorOpen className="size-4" aria-hidden="true" />Encerrar partida</Button></div>
          </div>

          <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <Card variant="elevated" className="min-w-0">
              <CardContent className="p-5 sm:p-8">
                <div ref={phaseRef} tabIndex={-1} className="focus:outline-none">
                  <QuizQuestion index={game.currentQuestionIndex + 1} total={game.totalQuestions} question={question.question} points={question.points} />
                </div>
                {game.status === 'results' ? (
                  <div className="mt-7 flex flex-col gap-6" aria-live="polite">
                    <div className="rounded-2xl border border-primary-200 bg-primary-50 p-5 text-center"><h2 className="type-h2 text-primary-950">Resultados da pergunta</h2><p className="type-body-sm mt-2 text-primary-800">Respostas e pontuações só serão exibidas quando os dados chegarem do servidor.</p></div>
                    <div className="grid gap-6 xl:grid-cols-2">
                      <div><h3 className="type-h3 mb-3 text-neutral-900">Alternativas e respostas</h3><div className="flex flex-col gap-2">
                        {question.options.map((option, index) => {
                          const isCorrect = option.id === correctOptionId;
                          const count = game.questionStatistics?.responsesByOption?.[option.id];
                          return <div key={option.id} className={`flex min-w-0 items-center gap-3 rounded-xl border-2 p-3 ${isCorrect ? 'border-success-500 bg-success-50' : 'border-border bg-surface'}`}>
                            {isCorrect ? <CheckCircle2 className="size-5 shrink-0 text-success-700" aria-hidden="true" /> : <span className="size-5 shrink-0" aria-hidden="true" />}
                            <span className="type-body min-w-0 flex-1 break-words text-neutral-900">{optionLabels[index] ?? index + 1}) {option.text}</span>
                            <Badge variant={isCorrect ? 'success' : 'neutral'}>{isCorrect ? 'Correta' : 'Respostas'}: {count ?? '—'}</Badge>
                          </div>;
                        })}
                      </div></div>
                      <div><h3 className="type-h3 mb-3 text-neutral-900">Ranking</h3><RankingList entries={game.ranking} /></div>
                    </div>
                  </div>
                ) : game.status === 'locked' ? (
                  <div className="mt-7 rounded-xl border border-warning-200 bg-warning-50 p-5 text-center" role="status" aria-live="polite"><h2 className="type-h3 text-warning-950">Pergunta encerrada</h2><p className="type-body-sm mt-2 text-warning-900">Mostre a área de resultados para revisar as informações recebidas.</p></div>
                ) : (
                  <div className="mt-7 grid gap-3 sm:grid-cols-2">
                    {question.options.map((option, index) => <div key={option.id} className="flex min-h-20 items-center gap-3 rounded-xl border-2 border-border bg-surface p-4"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 font-bold text-neutral-700">{optionLabels[index] ?? index + 1}</span><span className="type-body min-w-0 break-words font-medium text-neutral-900">{option.text}</span></div>)}
                  </div>
                )}
              </CardContent>
            </Card>

            <aside className="flex flex-col gap-4">
              <Card variant="elevated"><CardContent className="flex flex-col gap-4 p-5">
                <div className="flex items-center justify-between gap-3"><span className="type-body-sm flex items-center gap-2 text-neutral-600"><Users className="size-4" aria-hidden="true" />Jogadores</span><strong className="type-h3 text-neutral-900">{room.players.length}</strong></div>
                <StatCard label="Respostas registradas" value={game.questionStatistics?.totalResponses ?? game.ranking.length} />
                <StatCard label="Respostas corretas" value={game.questionStatistics?.correctResponses ?? '—'} />
                <p className="type-caption border-t border-border pt-3 text-neutral-500">Respostas e ranking recebidos do servidor.</p>
              </CardContent></Card>

              {game.status === 'locked' && <Button size="lg" className="w-full" onClick={next} disabled={connectionState !== 'synced'}><Flag className="size-4" aria-hidden="true" />{lastQuestion ? 'Ver resultado final' : 'Próxima pergunta'}</Button>}
              {game.status !== 'locked' && <div><Button size="lg" className="w-full" disabled aria-describedby="advance-disabled-reason">{lastQuestion ? 'Ver resultado final' : 'Aguardando pergunta'}</Button><p id="advance-disabled-reason" className="type-caption mt-2 text-center text-neutral-500">{disabledReason}</p></div>}
              <p className="type-caption text-center text-neutral-500">O servidor valida o tempo e controla o avanço da partida.</p>
            </aside>
          </section>
        </Container>
      </main>

      <Modal open={confirmEnd} onClose={() => setConfirmEnd(false)} title="Encerrar partida?" description="A partida local será encerrada e você verá o resultado final." actions={<><Button variant="outline" onClick={() => setConfirmEnd(false)}>Continuar partida</Button><Button variant="danger" onClick={endGame}>Encerrar partida</Button></>}>
        <p className="type-body-sm text-neutral-600">Dados finais ausentes permanecerão como “—”.</p>
      </Modal>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return <div className="min-w-0 rounded-xl border border-border bg-surface p-4"><p className="type-caption break-words text-neutral-500">{label}</p><p className="type-h3 mt-1 text-neutral-900">{value}</p></div>;
}

function HostState({ title, description, action }: { title: string; description: string; action: ReactNode }) {
  return <Container size="md" className="flex min-h-screen items-center justify-center py-10"><Card variant="elevated" className="w-full max-w-lg"><CardContent className="flex flex-col items-center gap-5 p-6 text-center sm:p-8"><EmptyState title={title} description={description} />{action}</CardContent></Card></Container>;
}
