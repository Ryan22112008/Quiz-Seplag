import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Copy, Ellipsis, LoaderCircle, Pencil, Play, Search, Trash2 } from 'lucide-react';
import { api, type LibraryQuery, type LibraryQuiz } from '@/services/api/client';
import { QUIZ_CATEGORIES } from '@/types/quiz';
import { useQuizStore } from '@/stores/quizStore';
import { useRoomStore } from '@/stores/roomStore';
import { toFrontendRoom } from '@/services/api/client';
import { Container } from '@/components/layout/Container';
import { Button } from '@/components/ui/Button';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { Dropdown } from '@/components/ui/Dropdown';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { imageSource } from '@/lib/imageSource';
import { useToastStore } from '@/components/ui/useToastStore';

const PAGE_SIZE = 24;
const dateLabel = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(value));

export function LibraryPage() {
  const navigate = useNavigate();
  const upsertQuiz = useQuizStore((state) => state.upsertQuiz);
  const upsertRoom = useRoomStore((state) => state.upsertRoom);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState<LibraryQuery>({ scope: 'all', sort: 'recent' });
  const [items, setItems] = useState<LibraryQuiz[]>([]);
  const itemsLength = useRef(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState('');
  const requestNumber = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery((current) => ({ ...current, q: search.trim() || undefined })), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async (append = false) => {
    const currentRequest = ++requestNumber.current;
    if (append) setLoadingMore(true); else { setLoading(true); setError(''); }
    try {
      const offset = append ? itemsLength.current : 0;
      const result = await api.getQuizzes({ ...query, offset, limit: PAGE_SIZE });
      if (currentRequest !== requestNumber.current) return;
      itemsLength.current = append ? itemsLength.current + result.items.length : result.items.length;
      setItems((current) => append ? [...current, ...result.items] : result.items);
      setTotal(result.total);
    } catch (cause) {
      if (currentRequest !== requestNumber.current) return;
      setError(cause instanceof Error ? cause.message : 'Tente novamente.');
    } finally { if (currentRequest === requestNumber.current) { setLoading(false); setLoadingMore(false); } }
  }, [query]);

  useEffect(() => { void load(); }, [load]);

  const perform = async (quiz: LibraryQuiz, action: 'duplicate' | 'delete' | 'start') => {
    if (action === 'delete' && !window.confirm(`Excluir “${quiz.title}”? Esta ação não pode ser desfeita.`)) return;
    setActionId(quiz.id);
    try {
      if (action === 'duplicate') {
        const copy = await api.duplicateQuiz(quiz.id);
        upsertQuiz(copy);
        navigate(`/criar/${copy.id}/perguntas`);
      } else if (action === 'delete') {
        await api.deleteQuiz(quiz.id);
        itemsLength.current = Math.max(0, itemsLength.current - 1);
        setItems((current) => current.filter((item) => item.id !== quiz.id));
        setTotal((count) => Math.max(0, count - 1));
        useToastStore.getState().push({ variant: 'success', title: 'Quiz excluído' });
      } else {
        const room = await api.createRoom(quiz.id);
        upsertRoom(toFrontendRoom(room));
        navigate(`/criar/${quiz.id}/sala`);
      }
    } catch (cause) {
      useToastStore.getState().push({ variant: 'danger', title: action === 'start' ? 'Não foi possível iniciar o quiz' : action === 'delete' ? 'Não foi possível excluir o quiz' : 'Não foi possível duplicar o quiz', description: cause instanceof Error ? cause.message : 'Tente novamente.' });
    } finally { setActionId(''); }
  };

  const renderCard = (quiz: LibraryQuiz) => {
    const isOwner = !quiz.isLegacy;
    const busy = actionId === quiz.id;
    const actions = [
      ...(isOwner ? [{ id: 'edit', label: 'Editar', icon: <Pencil />, onSelect: () => navigate(`/criar/${quiz.id}/perguntas?returnTo=%2Flibrary`) }] : []),
      { id: 'duplicate', label: 'Fazer uma cópia', icon: <Copy />, disabled: busy, onSelect: () => void perform(quiz, 'duplicate') },
      { id: 'start', label: 'Iniciar quiz', icon: <Play />, disabled: busy, onSelect: () => void perform(quiz, 'start') },
      ...(isOwner ? [{ id: 'delete', label: 'Excluir', icon: <Trash2 />, danger: true, disabled: busy, onSelect: () => void perform(quiz, 'delete') }] : []),
    ];
    return <Card key={quiz.id} variant="outlined" className="overflow-hidden">
      <div className="relative grid h-40 place-items-center overflow-hidden bg-gradient-to-br from-primary-800 via-primary-700 to-secondary-600">
        {quiz.coverImageUrl ? <img src={imageSource(quiz.coverImageUrl)} alt="" className="absolute inset-0 size-full object-cover" /> : <BookOpen className="size-14 text-white/80" aria-hidden="true" />}
        {quiz.isLegacy && <Badge className="absolute left-3 top-3">Quiz compartilhado</Badge>}
      </div>
      <CardContent className="flex min-h-48 flex-col p-5">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h2 className="type-h3 line-clamp-2 text-neutral-900">{quiz.title}</h2>
          <Dropdown label={`Ações para ${quiz.title}`} align="right" trigger={<Button variant="ghost" size="icon" aria-label={`Abrir ações de ${quiz.title}`}><Ellipsis className="size-5" /></Button>} items={actions} />
        </div>
        <p className="type-body-sm mb-4 line-clamp-2 text-neutral-600">{quiz.description || 'Sem descrição.'}</p>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 text-sm text-neutral-500">
          <span>{quiz.questionCount} {quiz.questionCount === 1 ? 'pergunta' : 'perguntas'}</span>
          <Badge variant="neutral">{QUIZ_CATEGORIES.find((category) => category.value === quiz.category)?.label ?? quiz.category}</Badge>
        </div>
        <p className="type-caption mt-3 text-neutral-500">Atualizado em {dateLabel(quiz.updatedAt)}</p>
      </CardContent>
    </Card>;
  };

  return <Container size="xl" className="min-h-screen py-10">
    <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="type-label mb-2 text-primary-700">SEUS CONTEÚDOS</p><h1 className="type-display text-neutral-900">Biblioteca de quizzes</h1><p className="type-body mt-2 text-neutral-600">Encontre, organize e inicie seus quizzes.</p></div>
      <ButtonLink to="/criar" size="lg">Criar quiz</ButtonLink>
    </div>
    <div className="mb-6 grid gap-3 rounded-2xl border border-border bg-white p-4 md:grid-cols-[minmax(15rem,1fr)_13rem_13rem]">
      <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-neutral-400" aria-hidden="true" /><Input aria-label="Buscar quizzes" inputClassName="pl-9" placeholder="Buscar pelo título ou descrição" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      <Select aria-label="Categoria" value={query.category ?? ''} onChange={(event) => setQuery((current) => ({ ...current, category: event.target.value || undefined }))} options={[{ value: '', label: 'Todas as categorias' }, ...QUIZ_CATEGORIES]} />
      <Select aria-label="Ordenação" value={query.sort ?? 'recent'} onChange={(event) => setQuery((current) => ({ ...current, sort: event.target.value as LibraryQuery['sort'] }))} options={[{ value: 'recent', label: 'Mais recentes' }, { value: 'oldest', label: 'Mais antigos' }, { value: 'title-asc', label: 'Título: A–Z' }, { value: 'title-desc', label: 'Título: Z–A' }]} />
    </div>
    <div className="mb-6 flex flex-wrap gap-2" aria-label="Filtrar biblioteca">
      {([{ value: 'all', label: 'Todos' }, { value: 'mine', label: 'Meus quizzes' }, { value: 'legacy', label: 'Compartilhados' }] as const).map((tab) => <Button key={tab.value} size="sm" variant={(query.scope ?? 'all') === tab.value ? 'primary' : 'outline'} onClick={() => setQuery((current) => ({ ...current, scope: tab.value }))}>{tab.label}</Button>)}
      <span className="ml-auto self-center text-sm text-neutral-500">{total} {total === 1 ? 'quiz' : 'quizzes'}</span>
    </div>
    {error ? <EmptyState title="Não foi possível carregar a biblioteca" description={error} action={<Button onClick={() => void load()}>Tentar novamente</Button>} /> : loading ? <div className="grid min-h-48 place-items-center" role="status"><LoaderCircle className="size-7 animate-spin text-primary-700" /><span className="sr-only">Carregando quizzes…</span></div> : items.length === 0 ? <EmptyState title={search || query.category ? 'Nenhum quiz encontrado' : 'Sua biblioteca está vazia'} description={search || query.category ? 'Altere a busca ou os filtros para ver outros quizzes.' : 'Crie seu primeiro quiz para começar.'} action={!search && !query.category ? <ButtonLink to="/criar">Criar quiz</ButtonLink> : undefined} /> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{items.map(renderCard)}</div>}
    {!loading && !error && items.length < total && <div className="mt-8 flex justify-center"><Button variant="outline" disabled={loadingMore} onClick={() => void load(true)}>{loadingMore ? 'Carregando…' : 'Carregar mais'}</Button></div>}
  </Container>;
}
