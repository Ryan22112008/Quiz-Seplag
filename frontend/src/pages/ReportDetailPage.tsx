import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Award, CheckCircle2, CircleHelp, Clock3, Play, Users, XCircle } from 'lucide-react';
import { Container } from '@/components/layout/Container';
import { Button } from '@/components/ui/Button';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { api, toFrontendRoom } from '@/services/api/client';
import { useRoomStore } from '@/stores/roomStore';
import { useToastStore } from '@/components/ui/useToastStore';
import { FinalPodium } from '@/components/game/FinalPodium';
import type { GameReport } from '@/types/report';

type ReportTab = 'summary' | 'participants' | 'questions' | 'podium';
const detailTabs: Array<{ id: ReportTab; label: string }> = [{ id: 'summary', label: 'Resumo' }, { id: 'participants', label: 'Participantes' }, { id: 'questions', label: 'Perguntas' }, { id: 'podium', label: 'Pódio' }];
const durationText = (seconds: number) => `${Math.floor(seconds / 60)} min ${seconds % 60} s`;

export function ReportDetailPage() {
  const { reportId = '' } = useParams<{ reportId: string }>();
  const navigate = useNavigate();
  const upsertRoom = useRoomStore((state) => state.upsertRoom);
  const pushToast = useToastStore((state) => state.push);
  const [report, setReport] = useState<GameReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<ReportTab>('summary');
  const [participantFilter, setParticipantFilter] = useState<'all' | 'incomplete'>('all');
  const [questionView, setQuestionView] = useState<'expanded' | 'compact'>('expanded');
  const [playing, setPlaying] = useState(false);

  useEffect(() => { let active = true; void api.getReport(reportId).then((data) => { if (active) setReport(data); }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível abrir este relatório.'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [reportId]);

  const filteredParticipants = useMemo(() => report?.details.participants.filter((player) => participantFilter === 'all' || !player.completed) ?? [], [report, participantFilter]);
  const incomplete = report?.details.participants.filter((player) => !player.completed) ?? [];
  const needHelp = report?.details.participants.filter((player) => player.answeredQuestions > 0 && player.correctAnswers / player.answeredQuestions < 0.5) ?? [];
  const difficult = report?.details.questions.filter((question) => question.answerCount > 0 && question.accuracyRate < 50) ?? [];

  const replay = async () => {
    if (!report) return;
    setPlaying(true);
    try { const room = await api.createRoom(report.quizId); upsertRoom(toFrontendRoom(room)); navigate(`/criar/${report.quizId}/sala`); }
    catch (cause) { pushToast({ variant: 'danger', title: 'Não foi possível iniciar outra partida', description: cause instanceof Error ? cause.message : 'Tente novamente.' }); setPlaying(false); }
  };

  if (loading) return <Container size="lg" className="grid min-h-80 place-items-center text-neutral-500" role="status">Carregando relatório…</Container>;
  if (error || !report) return <Container size="lg" className="grid min-h-80 place-items-center py-10 text-center"><div><CircleHelp className="mx-auto size-10 text-neutral-400" /><h1 className="type-h3 mt-3 text-neutral-900">Relatório indisponível</h1><p className="mt-2 text-sm text-neutral-600">{error || 'Não foi possível localizar este relatório.'}</p><ButtonLink to="/relatorios" variant="outline" className="mt-4"><ArrowLeft className="size-4" />Voltar aos relatórios</ButtonLink></div></Container>;

  const ranking = report.details.participants.map((player) => ({ position: player.position, playerId: player.id, playerName: player.name, avatarCharacterId: player.avatarCharacterId, avatarAccessoryId: player.avatarAccessoryId, score: player.score, answeredQuestions: player.answeredQuestions, correctAnswers: player.correctAnswers }));
  return <main className="min-h-[calc(100vh-4rem)] bg-neutral-50"><Container size="xl" className="py-6 sm:py-9">
    <ButtonLink to="/relatorios" variant="ghost" className="mb-4 -ml-3"><ArrowLeft className="size-4" />Todos os relatórios</ButtonLink>
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="type-caption font-semibold uppercase tracking-wide text-primary-700">Relatório da partida · PIN {report.roomPin}</p><h1 className="type-h1 mt-1 text-neutral-900">{report.details.quizTitle}</h1><p className="type-body-sm mt-2 text-neutral-600">Concluída em {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeStyle: 'short' }).format(new Date(report.finishedAt))}</p></div><Button size="lg" onClick={() => void replay()} loading={playing}><Play className="size-4" />Jogar de novo</Button></div>
    <div className="mb-6 flex gap-1 overflow-x-auto border-b border-border" role="tablist" aria-label="Seções do relatório">{detailTabs.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold ${tab === item.id ? 'border-primary-600 text-primary-800' : 'border-transparent text-neutral-500 hover:text-neutral-800'}`}>{item.label}</button>)}</div>

    {tab === 'summary' && <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-[1.1fr_2fr]" aria-label="Resumo de desempenho">
        <article className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface p-6 text-center"><div className="relative grid size-40 place-items-center rounded-full" style={{ background: `conic-gradient(#2563eb ${report.accuracyRate}%, #e8e8f0 0)` }}><div className="grid size-[122px] place-content-center rounded-full bg-surface"><strong className="text-3xl font-extrabold text-neutral-900">{report.accuracyRate}%</strong><span className="text-xs text-neutral-500">corretas</span></div></div><p className="mt-3 text-sm text-neutral-600">{report.correctAnswers} de {report.totalAnswers} respostas</p></article>
        <div className="grid gap-4 sm:grid-cols-3"><Metric Icon={Users} label="Participantes" value={report.participantCount} /><Metric Icon={CircleHelp} label="Perguntas" value={report.questionCount} /><Metric Icon={Clock3} label="Tempo de partida" value={durationText(report.durationSeconds)} /></div>
      </section>
      <section className="grid gap-4 lg:grid-cols-3"><Insight title="Perguntas difíceis" count={difficult.length} items={difficult.map((item) => `Pergunta ${item.number} · ${item.accuracyRate}% de acerto`)} empty="Nenhuma pergunta ficou abaixo de 50% de acerto." /><Insight title="Ajuda necessária" count={needHelp.length} items={needHelp.map((item) => `${item.name} · ${Math.round(item.correctAnswers / item.answeredQuestions * 100)}% de acerto`)} empty="Todos os participantes com respostas tiveram bom desempenho." /><Insight title="Não concluíram" count={incomplete.length} items={incomplete.map((item) => `${item.name} · ${item.missedQuestions} não respondida(s)`)} empty="Todos os participantes responderam a todas as perguntas." /></section>
      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6"><div className="mb-4 flex items-center justify-between"><div><h2 className="type-h3 text-neutral-900">Melhores colocados</h2><p className="mt-1 text-sm text-neutral-500">Veja o pódio completo da sessão.</p></div><Button variant="outline" onClick={() => setTab('podium')}>Ver pódio</Button></div><FinalPodium entries={ranking} /></section>
    </div>}

    {tab === 'participants' && <section className="overflow-hidden rounded-2xl border border-border bg-surface"><div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="type-h3 text-neutral-900">Desempenho dos participantes</h2><p className="mt-1 text-sm text-neutral-500">{filteredParticipants.length} participante(s)</p></div><div className="flex gap-2"><Button size="sm" variant={participantFilter === 'all' ? 'primary' : 'outline'} onClick={() => setParticipantFilter('all')}>Todos</Button><Button size="sm" variant={participantFilter === 'incomplete' ? 'primary' : 'outline'} onClick={() => setParticipantFilter('incomplete')}>Não concluíram ({incomplete.length})</Button></div></div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left"><thead className="bg-neutral-50 text-xs font-bold uppercase text-neutral-500"><tr><th className="px-5 py-3">Participante</th><th className="px-4 py-3">Posição</th><th className="px-4 py-3">Acertos</th><th className="px-4 py-3">Não respondidas</th><th className="px-4 py-3">Pontuação</th></tr></thead><tbody>{filteredParticipants.map((player) => <tr key={player.id} className="border-t border-border"><td className="px-5 py-3"><span className="block font-semibold text-neutral-900">{player.name}</span><span className="mt-0.5 block text-xs text-neutral-500">{player.email ?? 'E-mail não registrado'}</span></td><td className="px-4 py-3 text-sm text-neutral-700">#{player.position}</td><td className="px-4 py-3 text-sm text-neutral-700">{player.answeredQuestions ? `${Math.round(player.correctAnswers / player.answeredQuestions * 100)}% (${player.correctAnswers}/${player.answeredQuestions})` : '—'}</td><td className="px-4 py-3 text-sm text-neutral-700">{player.missedQuestions}</td><td className="px-4 py-3 text-sm font-bold tabular-nums text-neutral-900">{player.score.toLocaleString('pt-BR')}</td></tr>)}</tbody></table>{filteredParticipants.length === 0 && <p className="p-8 text-center text-sm text-neutral-500">Todos concluíram a partida.</p>}</div></section>}

    {tab === 'questions' && <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6"><div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="type-h3 text-neutral-900">Desempenho por pergunta</h2><p className="mt-1 text-sm text-neutral-500">Confira acertos e distribuição das alternativas.</p></div><div className="flex gap-2"><Button size="sm" variant={questionView === 'expanded' ? 'primary' : 'outline'} onClick={() => setQuestionView('expanded')}>Expandido</Button><Button size="sm" variant={questionView === 'compact' ? 'primary' : 'outline'} onClick={() => setQuestionView('compact')}>Compacto</Button></div></div><div className="space-y-3">{report.details.questions.map((question) => <article key={question.id} className="rounded-xl border border-border p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-primary-700">Pergunta {question.number} · {question.type}</p><h3 className={`mt-1 font-semibold text-neutral-900 ${questionView === 'compact' ? 'line-clamp-1' : ''}`}>{question.text || '(pergunta com imagem)'}</h3></div><div className="shrink-0"><strong className="text-lg text-neutral-900">{question.accuracyRate}%</strong><span className="ml-2 text-xs text-neutral-500">{question.correctCount}/{question.answerCount} acertos</span></div></div>{questionView === 'expanded' && <div className="mt-4 space-y-2">{question.options.map((option) => <div key={option.id} className="flex items-center gap-3"><span className={`size-2.5 rounded-full ${option.correct ? 'bg-emerald-500' : 'bg-neutral-300'}`} /><span className={`min-w-0 flex-1 truncate text-sm ${option.correct ? 'font-semibold text-emerald-800' : 'text-neutral-700'}`}>{option.text || '(imagem)'}</span><span className="text-xs tabular-nums text-neutral-500">{option.count} resposta(s)</span></div>)}</div>}</article>)}</div></section>}

    {tab === 'podium' && <section className="rounded-2xl border border-border bg-surface p-5 sm:p-8"><div className="mb-5 text-center"><Award className="mx-auto size-8 text-amber-500" /><h2 className="type-h2 mt-2 text-neutral-900">Pódio da partida</h2></div>{ranking.length ? <FinalPodium entries={ranking} /> : <p className="py-12 text-center text-sm text-neutral-500">Nenhum participante nesta partida.</p>}<div className="mt-5 text-center"><ButtonLink to="/relatorios" variant="outline">Voltar aos relatórios</ButtonLink></div></section>}
  </Container></main>;
}

function Metric({ Icon, label, value }: { Icon: typeof Users; label: string; value: string | number }) { return <article className="flex flex-col justify-center rounded-2xl border border-border bg-surface p-5"><Icon className="size-5 text-primary-700" /><p className="mt-4 text-sm text-neutral-500">{label}</p><strong className="mt-1 text-2xl font-bold text-neutral-900">{value}</strong></article>; }
function Insight({ title, count, items, empty }: { title: string; count: number; items: string[]; empty: string }) { return <article className="rounded-2xl border border-border bg-surface p-5"><div className="flex items-center justify-between"><h2 className="font-bold text-neutral-900">{title}</h2><span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-bold text-primary-800">{count}</span></div>{items.length ? <ul className="mt-3 space-y-2">{items.slice(0, 5).map((item) => <li key={item} className="flex items-start gap-2 text-sm text-neutral-700"><XCircle className="mt-0.5 size-4 shrink-0 text-amber-600" />{item}</li>)}</ul> : <p className="mt-3 flex gap-2 text-sm text-neutral-500"><CheckCircle2 className="size-4 shrink-0 text-emerald-600" />{empty}</p>}</article>; }
