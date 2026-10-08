import { useEffect, useMemo, useState } from 'react';
import { BookOpen, CalendarDays, Clock3, MoreHorizontal, RotateCcw, Search, Trash2, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Container } from '@/components/layout/Container';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToastStore } from '@/components/ui/useToastStore';
import { api } from '@/services/api/client';
import type { GameReport } from '@/types/report';

type ReportSection = 'kahoots' | 'trash';
function dateLabel(value: string) { return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
function displayTitle(value: string) { return value ? value[0].toLocaleUpperCase('pt-BR') + value.slice(1) : value; }

export function ReportsPage() {
  const [section, setSection] = useState<ReportSection>('kahoots');
  const [reports, setReports] = useState<GameReport[]>([]);
  const [trash, setTrash] = useState<GameReport[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pushToast = useToastStore((state) => state.push);
  const load = async () => { setLoading(true); setError(''); try { const [all, deleted] = await Promise.all([api.getReports(), api.getReportTrash()]); setReports(all); setTrash(deleted); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os relatórios.'); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);

  const source = section === 'trash' ? trash : reports;
  const visible = useMemo(() => source.filter((report) => report.details.quizTitle.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR'))), [source, query]);
  const selectAll = (checked: boolean) => setSelected(checked ? visible.map((report) => report.id) : []);
  const moveToTrash = async (items: GameReport[]) => {
    try { await Promise.all(items.map((item) => api.deleteReport(item.id))); const ids = new Set(items.map((item) => item.id)); setReports((current) => current.filter((item) => !ids.has(item.id))); setTrash((current) => [...items, ...current]); setSelected([]); pushToast({ variant: 'success', title: items.length > 1 ? 'Relatórios movidos para a lixeira.' : 'Relatório movido para a lixeira.' }); }
    catch (cause) { pushToast({ variant: 'danger', title: 'Não foi possível mover os relatórios', description: cause instanceof Error ? cause.message : undefined }); }
  };
  const restore = async (report: GameReport) => { try { await api.restoreReport(report.id); setTrash((current) => current.filter((item) => item.id !== report.id)); setReports((current) => [report, ...current]); pushToast({ variant: 'success', title: 'Relatório restaurado.' }); } catch (cause) { pushToast({ variant: 'danger', title: 'Não foi possível restaurar', description: cause instanceof Error ? cause.message : undefined }); } setOpenMenu(null); };
  const erase = async (report: GameReport) => { if (!window.confirm(`Excluir o relatório de “${report.details.quizTitle}” permanentemente?`)) return; try { await api.permanentlyDeleteReport(report.id); setTrash((current) => current.filter((item) => item.id !== report.id)); setSelected((current) => current.filter((id) => id !== report.id)); pushToast({ variant: 'success', title: 'Relatório excluído permanentemente.' }); } catch (cause) { pushToast({ variant: 'danger', title: 'Não foi possível excluir', description: cause instanceof Error ? cause.message : undefined }); } setOpenMenu(null); };
  const eraseSelected = async () => {
    const items = trash.filter((report) => selected.includes(report.id));
    if (!items.length || !window.confirm(`Apagar permanentemente ${items.length} relatório(s) selecionado(s)? Essa ação não pode ser desfeita.`)) return;
    const results = await Promise.allSettled(items.map((report) => api.permanentlyDeleteReport(report.id)));
    const deletedIds = new Set(items.filter((_, index) => results[index]?.status === 'fulfilled').map((report) => report.id));
    const failedCount = items.length - deletedIds.size;
    setTrash((current) => current.filter((report) => !deletedIds.has(report.id)));
    setSelected((current) => current.filter((id) => !deletedIds.has(id)));
    if (failedCount) pushToast({ variant: 'danger', title: 'Alguns relatórios não foram apagados', description: `${deletedIds.size} apagado(s), ${failedCount} com erro. Você pode tentar novamente.` });
    else pushToast({ variant: 'success', title: `${deletedIds.size} relatório(s) apagado(s) permanentemente.` });
  };

  return <main className="min-h-[calc(100vh-4rem)] bg-neutral-50"><Container size="xl" className="py-6 sm:py-9">
    <div className="mb-7"><p className="type-caption font-semibold uppercase tracking-[0.18em] text-primary-800">Acompanhe resultados</p><h1 className="type-h1 mt-1 text-neutral-900">Relatórios</h1><p className="type-body mt-2 text-neutral-600">Histórico das partidas e análise do desempenho dos participantes.</p></div>
    <div className="grid gap-6 lg:grid-cols-[225px_minmax(0,1fr)]">
      <aside className="h-fit rounded-2xl border border-border bg-surface p-3" aria-label="Filtros de relatórios"><p className="px-3 pb-2 pt-2 text-xs font-bold uppercase tracking-wide text-neutral-500">Categorias</p><button type="button" onClick={() => { setSection('kahoots'); setSelected([]); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${section === 'kahoots' ? 'bg-primary-700 text-white' : 'text-neutral-700 hover:bg-neutral-100'}`}><BookOpen className="size-4" />Quizzes</button><div className="my-4 border-t border-border" /><button type="button" onClick={() => { setSection('trash'); setSelected([]); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${section === 'trash' ? 'bg-primary-700 text-white' : 'text-neutral-700 hover:bg-neutral-100'}`}><Trash2 className="size-4" />Lixeira<span className="ml-auto text-xs opacity-70">{trash.length}</span></button></aside>
      <section className="min-w-0 rounded-2xl border border-border bg-surface p-4 sm:p-6" aria-label="Histórico de partidas">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="type-h3 text-neutral-900">{section === 'trash' ? 'Relatórios excluídos' : 'Histórico de sessões'}</h2><p className="type-body-sm mt-1 text-neutral-500">{section === 'trash' ? 'Restaure ou exclua permanentemente relatórios.' : 'Selecione uma sessão para analisar os resultados.'}</p></div><div className="relative w-full sm:max-w-xs"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" /><Input aria-label="Buscar quiz" placeholder="Buscar quiz..." value={query} onChange={(event) => setQuery(event.target.value)} inputClassName="pl-10" /></div></div>
        {selected.length > 0 && <div className="mb-4 flex items-center justify-between rounded-xl bg-primary-50 px-4 py-3"><span className="text-sm font-semibold text-primary-900">{selected.length} selecionado(s)</span>{section === 'trash' ? <Button size="sm" variant="danger" onClick={() => void eraseSelected()}><Trash2 className="size-4" />Apagar selecionados</Button> : <Button size="sm" variant="outline" onClick={() => void moveToTrash(visible.filter((item) => selected.includes(item.id)))}><Trash2 className="size-4" />Mover para lixeira</Button>}</div>}
        {loading ? <div className="grid min-h-60 place-items-center text-sm text-neutral-500" role="status">Carregando relatórios…</div>
          : error ? <div className="grid min-h-60 place-items-center text-center"><div><p role="alert" className="text-sm text-danger-700">{error}</p><Button className="mt-3" variant="outline" onClick={() => void load()}>Tentar novamente</Button></div></div>
          : visible.length === 0 ? <Empty title={section === 'trash' ? 'A lixeira está vazia' : query ? 'Nenhuma sessão encontrada' : 'Nenhuma partida concluída ainda'} description={section === 'trash' ? 'Relatórios excluídos aparecerão aqui.' : 'Quando uma partida de um quiz seu for concluída, o relatório ficará disponível aqui.'} />
          : <div className="overflow-x-auto rounded-2xl"><table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-left"><thead><tr className="text-xs font-bold uppercase tracking-wide text-neutral-500"><th className="w-12 px-2 py-2"><input type="checkbox" aria-label="Selecionar todos os relatórios" checked={visible.length > 0 && selected.length === visible.length} onChange={(event) => selectAll(event.target.checked)} className="size-4 accent-[#2563eb]" /></th><th className="px-3 py-2">Quiz / modo</th><th className="px-3 py-2">Participantes</th><th className="px-3 py-2">Respostas corretas</th><th className="px-3 py-2">Término</th><th className="w-12 px-2 py-2"><span className="sr-only">Ações</span></th></tr></thead><tbody>{visible.map((report) => <tr key={report.id} className="group bg-[#111a2a] shadow-sm transition duration-150 hover:bg-[#1a2638]"><td className="rounded-l-xl border-y border-l border-[#26364d] px-2 py-3"><input type="checkbox" aria-label={`Selecionar relatório de ${report.details.quizTitle}`} checked={selected.includes(report.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, report.id] : current.filter((id) => id !== report.id))} className="size-4 accent-[#2563eb]" /></td><td className="border-y border-[#26364d] px-3 py-3"><Link to={`/relatorios/${encodeURIComponent(report.id)}`} className="flex min-w-64 items-center rounded-lg"><span className="min-w-0"><strong className="block max-w-64 truncate text-sm font-bold text-[#f2f7ff] transition group-hover:text-[#bfdbfe]">{displayTitle(report.details.quizTitle)}</strong><span className="mt-1 block text-xs text-[#b7c6d9]">{report.questionCount} {report.questionCount === 1 ? 'pergunta' : 'perguntas'} <span className="px-1 text-[#8292a8]">·</span> Quiz ao vivo <span className="px-1 text-[#8292a8]">·</span> PIN {report.roomPin}</span></span></Link></td><td className="border-y border-[#26364d] px-3 py-3"><span className="inline-flex items-center gap-1.5 rounded-full border border-[#3b82f6] bg-[#172844] px-2.5 py-1 text-sm font-semibold text-[#bfdbfe]"><Users className="size-4 text-[#93c5fd]" />{report.participantCount}</span></td><td className="border-y border-[#26364d] px-3 py-3"><span className="text-sm font-semibold text-[#f2f7ff]">{report.accuracyRate}%</span><span className="ml-2 text-xs text-[#b7c6d9]">({report.correctAnswers}/{report.totalAnswers})</span></td><td className="border-y border-[#26364d] px-3 py-3"><span className="inline-flex items-center gap-2 whitespace-nowrap text-sm text-[#cfdaea]"><CalendarDays className="size-4 text-[#9eafc5]" />{dateLabel(report.finishedAt)}</span></td><td className="relative rounded-r-xl border-y border-r border-[#26364d] px-2 py-3"><button type="button" aria-label={`Ações do relatório de ${report.details.quizTitle}`} aria-expanded={openMenu === report.id} onClick={() => setOpenMenu((current) => current === report.id ? null : report.id)} className="grid size-9 place-items-center rounded-lg text-[#cfdaea] transition hover:bg-[#293a52]"><MoreHorizontal className="size-5" /></button>{openMenu === report.id && <div className="absolute right-2 top-12 z-20 w-48 rounded-xl border border-border bg-[#111a2a] p-1.5 shadow-xl">{section === 'trash' ? <><button type="button" onClick={() => void restore(report)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-neutral-100"><RotateCcw className="size-4" />Restaurar</button><button type="button" onClick={() => void erase(report)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-danger-700 hover:bg-danger-50"><Trash2 className="size-4" />Excluir para sempre</button></> : <button type="button" onClick={() => void moveToTrash([report])} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-danger-700 hover:bg-danger-50"><Trash2 className="size-4" />Mover para lixeira</button>}</div>}</td></tr>)}</tbody></table></div>}
      </section>
    </div>
  </Container></main>;
}

function Empty({ title, description }: { title: string; description: string }) { return <div className="grid min-h-64 place-items-center px-6 text-center"><div className="max-w-sm"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-neutral-100 text-neutral-500"><Clock3 className="size-6" /></span><h3 className="type-h3 mt-4 text-neutral-900">{title}</h3><p className="type-body-sm mt-2 text-neutral-600">{description}</p></div></div>; }
