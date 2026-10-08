import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Check, Clock3, Copy, Folder, FolderPlus, Grid2X2, Heart, List, MoreHorizontal, Search, Trash2, Undo2, BookMarked, GraduationCap, FilePenLine } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Container } from '@/components/layout/Container';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToastStore } from '@/components/ui/useToastStore';
import { api } from '@/services/api/client';
import { useAuthStore } from '@/stores/authStore';
import { useQuizStore } from '@/stores/quizStore';
import { imageSource } from '@/lib/imageSource';
import type { Quiz } from '@/types/quiz';

type MainTab = 'recent' | 'drafts' | 'favorites' | 'shared';
type LibrarySection = 'kahoots' | 'stories' | 'courses' | 'trash';
interface LibraryPreferences { favorites: string[]; folders: string[]; quizFolders: Record<string, string> }
const emptyPreferences: LibraryPreferences = { favorites: [], folders: [], quizFolders: {} };
const isQuizDraft = (quiz: Quiz) => quiz.isDraft === true || quiz.questions.length === 0;
const tabs: Array<{ id: MainTab; label: string }> = [
  { id: 'recent', label: 'Recentes' }, { id: 'drafts', label: 'Rascunhos' },
  { id: 'favorites', label: 'Favoritos' }, { id: 'shared', label: 'Compartilhados comigo' },
];
const sections: Array<{ id: LibrarySection; label: string; Icon: typeof BookOpen }> = [
  { id: 'kahoots', label: 'Quizzes', Icon: BookOpen }, { id: 'stories', label: 'Histórias', Icon: BookMarked },
  { id: 'courses', label: 'Cursos', Icon: GraduationCap },
];

function readPreferences(userId: string): LibraryPreferences {
  try {
    const raw = localStorage.getItem(`quiz-seplag-library:${userId}`);
    if (!raw) return emptyPreferences;
    const parsed = JSON.parse(raw) as Partial<LibraryPreferences>;
    return { favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [], folders: Array.isArray(parsed.folders) ? parsed.folders : [], quizFolders: parsed.quizFolders && typeof parsed.quizFolders === 'object' ? parsed.quizFolders : {} };
  } catch { return emptyPreferences; }
}

export function LibraryPage() {
  const user = useAuthStore((state) => state.user);
  const userId = user?.id;
  const upsertQuiz = useQuizStore((state) => state.upsertQuiz);
  const removeQuiz = useQuizStore((state) => state.deleteQuiz);
  const [section, setSection] = useState<LibrarySection>('kahoots');
  const [tab, setTab] = useState<MainTab>('recent');
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [trash, setTrash] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [folder, setFolder] = useState<string | null>(null);
  const [newFolder, setNewFolder] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<LibraryPreferences>(() => user ? readPreferences(user.id) : emptyPreferences);
  const pushToast = useToastStore((state) => state.push);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [items, deleted] = await Promise.all([api.getMyQuizzes(), api.getQuizTrash()]);
      setQuizzes(items); setTrash(deleted); items.forEach(upsertQuiz);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível carregar sua biblioteca.'); }
    finally { setLoading(false); }
  }, [upsertQuiz]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPreferences(userId ? readPreferences(userId) : emptyPreferences); }, [userId]);
  useEffect(() => { if (userId) localStorage.setItem(`quiz-seplag-library:${userId}`, JSON.stringify(preferences)); }, [preferences, userId]);

  const visibleQuizzes = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR');
    return quizzes.filter((quiz) => {
      if (folder && preferences.quizFolders[quiz.id] !== folder) return false;
      if (tab === 'drafts' && !isQuizDraft(quiz)) return false;
      if (tab === 'recent' && isQuizDraft(quiz)) return false;
      if (tab === 'favorites' && !preferences.favorites.includes(quiz.id)) return false;
      if (tab === 'shared') return false;
      return !normalized || quiz.title.toLocaleLowerCase('pt-BR').includes(normalized);
    }).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }, [quizzes, folder, preferences, query, tab]);
  const visibleTrash = useMemo(() => trash.filter((quiz) => !query.trim() || quiz.title.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR'))), [trash, query]);

  const addFolder = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const name = folderName.trim();
    if (!name) return;
    if (preferences.folders.some((item) => item.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) { pushToast({ variant: 'danger', title: 'Essa pasta já existe.' }); return; }
    setPreferences((current) => ({ ...current, folders: [...current.folders, name] })); setFolder(name); setFolderName(''); setNewFolder(false);
  };
  const toggleFavorite = (quizId: string) => setPreferences((current) => ({ ...current, favorites: current.favorites.includes(quizId) ? current.favorites.filter((id) => id !== quizId) : [...current.favorites, quizId] }));
  const duplicate = async (quiz: Quiz) => {
    try { const copy = await api.duplicateQuiz(quiz.id); setQuizzes((current) => [copy, ...current]); upsertQuiz(copy); pushToast({ variant: 'success', title: 'Quiz duplicado.' }); }
    catch (cause) { pushToast({ variant: 'danger', title: 'Não foi possível duplicar', description: cause instanceof Error ? cause.message : undefined }); }
    setOpenMenu(null);
  };
  const moveToTrash = async (quiz: Quiz) => {
    try { await api.deleteQuiz(quiz.id); setQuizzes((current) => current.filter((item) => item.id !== quiz.id)); setTrash((current) => [quiz, ...current]); removeQuiz(quiz.id); setPreferences((current) => ({ ...current, favorites: current.favorites.filter((id) => id !== quiz.id), quizFolders: Object.fromEntries(Object.entries(current.quizFolders).filter(([id]) => id !== quiz.id)) })); pushToast({ variant: 'success', title: 'Quiz movido para a lixeira.' }); }
    catch (cause) { pushToast({ variant: 'danger', title: 'Não foi possível excluir', description: cause instanceof Error ? cause.message : undefined }); }
    setOpenMenu(null);
  };
  const restore = async (quiz: Quiz) => {
    try { await api.restoreQuiz(quiz.id); setTrash((current) => current.filter((item) => item.id !== quiz.id)); setQuizzes((current) => [quiz, ...current]); upsertQuiz(quiz); pushToast({ variant: 'success', title: 'Quiz restaurado.' }); }
    catch (cause) { pushToast({ variant: 'danger', title: 'Não foi possível restaurar', description: cause instanceof Error ? cause.message : undefined }); }
  };
  const permanentlyDelete = async (quiz: Quiz) => {
    if (!window.confirm(`Excluir “${quiz.title}” permanentemente? Essa ação não pode ser desfeita.`)) return;
    try { await api.permanentlyDeleteQuiz(quiz.id); setTrash((current) => current.filter((item) => item.id !== quiz.id)); pushToast({ variant: 'success', title: 'Quiz excluído permanentemente.' }); }
    catch (cause) { pushToast({ variant: 'danger', title: 'Não foi possível excluir', description: cause instanceof Error ? cause.message : undefined }); }
  };

  const isTrash = section === 'trash';
  const unsupported = section !== 'kahoots' && !isTrash;
  const displayedQuizzes = isTrash ? visibleTrash : visibleQuizzes;
  return <main className="min-h-[calc(100vh-4rem)] bg-neutral-50">
    <Container size="xl" className="py-6 sm:py-9">
      <div className="mb-7">
        <p className="type-caption font-semibold uppercase tracking-[0.18em] text-primary-700">Seu espaço</p>
        <h1 className="type-h1 mt-1 text-neutral-900">Biblioteca</h1>
        <p className="type-body mt-2 text-neutral-600">Organize seus quizzes e encontre rapidamente o que criou.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[235px_minmax(0,1fr)]">
        <aside className="h-fit rounded-2xl border border-border bg-surface p-3" aria-label="Categorias da biblioteca">
          <p className="px-3 pb-2 pt-2 text-xs font-bold uppercase tracking-wide text-neutral-500">Conteúdos</p>
          <nav className="space-y-1">
            {sections.map(({ id, label, Icon }) => <button key={id} type="button" onClick={() => { setSection(id); setFolder(null); setTab('recent'); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${section === id ? 'bg-primary-700 text-white' : 'text-neutral-700 hover:bg-neutral-100'}`}><Icon className="size-4" aria-hidden="true" />{label}{id === 'kahoots' && <span className={`ml-auto text-xs ${section === id ? 'text-white/75' : 'text-neutral-400'}`}>{quizzes.length}</span>}</button>)}
          </nav>
          <div className="my-4 border-t border-border" />
          <div className="flex items-center justify-between px-3 pb-2"><p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Minhas pastas</p><button type="button" aria-label="Criar pasta" onClick={() => setNewFolder((value) => !value)} className="rounded-lg p-1.5 text-neutral-600 hover:bg-neutral-100 hover:text-primary-700"><FolderPlus className="size-4" /></button></div>
          {newFolder && <form className="mb-2 flex gap-1 px-1" onSubmit={addFolder}><input autoFocus value={folderName} onChange={(event) => setFolderName(event.target.value)} maxLength={40} placeholder="Nome da pasta" aria-label="Nome da pasta" className="min-w-0 flex-1 rounded-lg border border-border px-2 py-1.5 text-sm outline-none focus:border-primary-500" /><Button size="sm" type="submit" aria-label="Salvar pasta"><Check className="size-4" /></Button></form>}
          <div className="space-y-1">{preferences.folders.length === 0 && <p className="px-3 py-2 text-xs text-neutral-500">Crie uma pasta para organizar seus quizzes.</p>}{preferences.folders.map((name) => <button type="button" key={name} onClick={() => { setSection('kahoots'); setFolder(folder === name ? null : name); setTab('recent'); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm ${folder === name ? 'bg-primary-50 font-semibold text-primary-800' : 'text-neutral-700 hover:bg-neutral-100'}`}><Folder className="size-4" /> <span className="truncate">{name}</span></button>)}</div>
          <div className="my-4 border-t border-border" />
          <button type="button" onClick={() => { setSection('trash'); setFolder(null); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${isTrash ? 'bg-primary-700 text-white' : 'text-neutral-700 hover:bg-neutral-100'}`}><Trash2 className="size-4" />Lixeira<span className="ml-auto text-xs opacity-70">{trash.length}</span></button>
        </aside>

        <section className="min-w-0 rounded-2xl border border-border bg-surface p-4 sm:p-6" aria-label="Conteúdos">
          {!unsupported && <>
            {!isTrash && <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border">
              <div role="tablist" aria-label="Filtrar quizzes" className="flex max-w-full gap-1 overflow-x-auto">{tabs.map((item) => <button type="button" role="tab" aria-selected={tab === item.id} key={item.id} onClick={() => { setTab(item.id); setFolder(null); }} className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold ${tab === item.id ? 'border-primary-600 text-primary-800' : 'border-transparent text-neutral-500 hover:text-neutral-800'}`}>{item.label}{item.id === 'drafts' && <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${tab === 'drafts' ? 'bg-primary-100 text-primary-800' : 'bg-neutral-100 text-neutral-600'}`}>{quizzes.filter(isQuizDraft).length}</span>}</button>)}</div>
              <Link to="/criar" className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-bold text-white hover:bg-primary-700">+ Criar quiz</Link>
            </div>}
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" /><Input aria-label="Pesquisar na biblioteca" placeholder="Pesquisar quizzes..." value={query} onChange={(event) => setQuery(event.target.value)} inputClassName="pl-10" /></div>
              <div className="flex items-center gap-1 self-end rounded-xl border border-border p-1 sm:self-auto" aria-label="Modo de visualização"><button aria-label="Visualização em grade" aria-pressed={view === 'grid'} type="button" onClick={() => setView('grid')} className={`rounded-lg p-2 ${view === 'grid' ? 'bg-primary-50 text-primary-700' : 'text-neutral-500 hover:bg-neutral-100'}`}><Grid2X2 className="size-4" /></button><button aria-label="Visualização em lista" aria-pressed={view === 'list'} type="button" onClick={() => setView('list')} className={`rounded-lg p-2 ${view === 'list' ? 'bg-primary-50 text-primary-700' : 'text-neutral-500 hover:bg-neutral-100'}`}><List className="size-4" /></button></div>
            </div>
          </>}

          {unsupported ? <div className="grid min-h-80 place-items-center px-6 text-center"><div className="max-w-sm"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary-50 text-primary-700"><BookOpen className="size-7" /></div><h2 className="type-h3 mt-4 text-neutral-900">Esta categoria ainda não está disponível</h2><p className="type-body-sm mt-2 text-neutral-600">Por enquanto, a Biblioteca organiza quizzes. Outros formatos poderão ser adicionados depois.</p><button type="button" onClick={() => setSection('kahoots')} className="mt-4 text-sm font-bold text-primary-700 hover:underline">Ver meus quizzes</button></div></div>
            : loading ? <div className="grid min-h-64 place-items-center text-sm text-neutral-500" role="status"><Clock3 className="mr-2 inline size-4 animate-pulse" />Carregando biblioteca…</div>
            : error ? <div className="grid min-h-64 place-items-center text-center"><div><p role="alert" className="text-sm text-danger-700">{error}</p><Button className="mt-3" variant="outline" onClick={() => void load()}>Tentar novamente</Button></div></div>
            : displayedQuizzes.length === 0 ? <div className="grid min-h-72 place-items-center px-6 text-center"><div className="max-w-sm"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-neutral-100 text-neutral-500">{tab === 'drafts' ? <FilePenLine className="size-6" /> : <Search className="size-6" />}</div><h2 className="type-h3 mt-4 text-neutral-900">{isTrash ? 'A lixeira está vazia' : tab === 'drafts' ? 'Nenhum rascunho por enquanto' : tab === 'favorites' ? 'Nenhum quiz favorito ainda' : tab === 'shared' ? 'Nada compartilhado com você' : folder ? 'Esta pasta está vazia' : query ? 'Nenhum quiz encontrado' : 'Sua biblioteca está vazia'}</h2><p className="type-body-sm mt-2 text-neutral-600">{isTrash ? 'Quizzes excluídos aparecerão aqui e poderão ser restaurados.' : tab === 'drafts' ? 'Salve um quiz sem terminar para continuar editando depois.' : tab === 'shared' ? 'Quando alguém compartilhar um quiz com você, ele aparecerá aqui.' : 'Crie seu primeiro quiz para começar a montar sua biblioteca.'}</p>{!isTrash && tab !== 'shared' && <Link to="/criar" className="mt-4 inline-flex rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-700">Criar quiz</Link>}</div></div>
            : <div className={view === 'grid' ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3' : 'flex flex-col gap-3'}>{displayedQuizzes.map((quiz) => <QuizCard key={quiz.id} quiz={quiz} userName={user?.name ?? 'Você'} list={view === 'list'} trashed={isTrash} favorite={preferences.favorites.includes(quiz.id)} folders={preferences.folders} currentFolder={preferences.quizFolders[quiz.id] ?? ''} openMenu={openMenu === quiz.id} onMenu={() => setOpenMenu((current) => current === quiz.id ? null : quiz.id)} onFavorite={() => toggleFavorite(quiz.id)} onMove={(name) => { setPreferences((current) => ({ ...current, quizFolders: { ...current.quizFolders, [quiz.id]: name } })); setOpenMenu(null); }} onDuplicate={() => void duplicate(quiz)} onTrash={() => void moveToTrash(quiz)} onRestore={() => void restore(quiz)} onPermanentDelete={() => void permanentlyDelete(quiz)} />)}</div>}
        </section>
      </div>
    </Container>
  </main>;
}

function QuizCard({ quiz, userName, list, trashed, favorite, folders, currentFolder, openMenu, onMenu, onFavorite, onMove, onDuplicate, onTrash, onRestore, onPermanentDelete }: { quiz: Quiz; userName: string; list: boolean; trashed: boolean; favorite: boolean; folders: string[]; currentFolder: string; openMenu: boolean; onMenu: () => void; onFavorite: () => void; onMove: (name: string) => void; onDuplicate: () => void; onTrash: () => void; onRestore: () => void; onPermanentDelete: () => void }) {
  const [selectedFolder, setSelectedFolder] = useState(currentFolder);
  useEffect(() => { setSelectedFolder(currentFolder); }, [currentFolder, openMenu]);
  const displayTitle = quiz.title ? quiz.title[0].toLocaleUpperCase('pt-BR') + quiz.title.slice(1) : quiz.title;
  const coverImage = quiz.questions.find((question) => question.imageUrl)?.imageUrl;
  const draft = isQuizDraft(quiz);
  const gradient = 'from-[#1d4ed8] via-[#3478eb] to-[#8bb5ff]';
  return <article className={`group relative overflow-visible rounded-2xl border border-[#e3e6ef] bg-white shadow-[0_8px_24px_rgba(19,24,40,0.08)] transition duration-200 hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-[0_16px_32px_rgba(37,99,214,0.18)] ${list ? 'flex min-h-28 items-center gap-4 p-3' : ''}`}>
    {list ? <div className={`relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br ${gradient} text-white shadow-inner`}><span className="text-center"><strong className="block text-2xl font-bold leading-none">{String(quiz.questions.length).padStart(2, '0')}</strong><span className="mt-1 block text-[9px] font-semibold uppercase tracking-wider text-white/80">perguntas</span></span>{draft && <span className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-primary-700"><FilePenLine className="size-3" /></span>}</div> : <div className={`relative flex h-44 items-center justify-center overflow-hidden rounded-t-2xl bg-gradient-to-br ${gradient} text-white`}>
      {coverImage && <img src={imageSource(coverImage)} alt="" className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-105" />}
      <div aria-hidden="true" className={`absolute inset-0 ${coverImage ? 'bg-gradient-to-t from-slate-950/65 via-blue-950/20 to-slate-950/10' : ''}`} />
      <div aria-hidden="true" className="absolute -right-10 -top-16 size-48 rounded-full bg-white/20 blur-2xl" /><div aria-hidden="true" className="absolute -bottom-24 -left-12 size-52 rounded-full bg-blue-200/30 blur-2xl" />
      <span className="absolute left-3 top-3 rounded-full border border-white/40 bg-white/20 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white shadow-sm backdrop-blur-md">{quiz.category}</span>
      {draft && <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/50 bg-white/90 px-3 py-1.5 text-xs font-bold text-primary-800 shadow-sm"><FilePenLine className="size-3.5" />Rascunho</span>}
      {!coverImage && <span aria-hidden="true" className="relative size-16 rounded-full border border-white/30 bg-white/10 shadow-[0_10px_30px_rgba(55,49,120,0.16)] backdrop-blur-sm"><span className="absolute inset-3 rounded-full border border-white/35 bg-white/10" /><span className="absolute -right-1 top-1 size-3 rounded-full bg-white/60" /></span>}
      <span className="absolute bottom-3 right-3 rounded-full border border-white/40 bg-[#153b83]/60 px-3 py-1.5 text-xs font-bold text-white shadow-sm backdrop-blur-md">{quiz.questions.length} {quiz.questions.length === 1 ? 'pergunta' : 'perguntas'}</span>
    </div>}
    <div className={`min-w-0 flex-1 ${list ? '' : 'p-4'}`}><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-primary-700">{draft ? 'Em edição' : 'Quiz'}</p><Link to={`/criar/${quiz.id}/perguntas`} className="line-clamp-2 text-[17px] font-bold leading-snug text-[#171b24] transition hover:text-[#1d4ed8]">{displayTitle}</Link><p className="mt-1 truncate text-sm text-[#596273]">por {userName}</p></div>{favorite && <Heart className="mt-1 size-4 shrink-0 fill-rose-500 text-rose-500" aria-label="Favorito" />}</div>
      {list && <p className="mt-2 text-xs text-[#697386]">{quiz.questions.length} {quiz.questions.length === 1 ? 'pergunta' : 'perguntas'} · Atualizado {new Date(quiz.updatedAt).toLocaleDateString('pt-BR')}</p>}
      <div className={`relative mt-4 flex items-center justify-between border-t border-[#edf0f4] pt-3 ${list ? 'max-w-64' : ''}`}><span className="text-xs font-medium text-[#596273]">Atualizado {new Date(quiz.updatedAt).toLocaleDateString('pt-BR')}</span><div className="relative"><button type="button" onClick={onMenu} aria-label={`Opções de ${quiz.title}`} aria-expanded={openMenu} className="grid size-8 place-items-center rounded-lg text-[#596273] transition hover:bg-[#f3f4f6] hover:text-primary-700"><MoreHorizontal className="size-5" /></button>{openMenu && <div className="absolute right-0 top-9 z-20 w-52 rounded-xl border border-[#e5e7eb] bg-white p-1.5 text-[#374151] shadow-xl" role="menu">
        {trashed ? <><button role="menuitem" onClick={onRestore} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-[#f3f4f6]"><Undo2 className="size-4" />Restaurar</button><button role="menuitem" onClick={onPermanentDelete} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[#dc2626] hover:bg-[#fef2f2]"><Trash2 className="size-4" />Excluir permanentemente</button></> : <><Link role="menuitem" to={`/criar/${quiz.id}/perguntas`} onClick={onMenu} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#374151] hover:bg-[#f3f4f6]">Editar quiz</Link><button role="menuitem" onClick={onDuplicate} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[#374151] hover:bg-[#f3f4f6]"><Copy className="size-4" />Duplicar</button><button role="menuitem" onClick={onFavorite} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[#374151] hover:bg-[#f3f4f6]"><Heart className="size-4" />{favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}</button>{folders.length > 0 && <div className="px-3 py-2"><label className="flex flex-col gap-1 text-xs text-[#596273]">Mover para pasta<select aria-label="Mover para pasta" value={selectedFolder} onChange={(event) => setSelectedFolder(event.target.value)} className="rounded-md border border-[#d1d5db] bg-white px-2 py-1.5 text-sm text-[#374151]"><option value="">Sem pasta</option>{folders.map((name) => <option key={name} value={name}>{name}</option>)}</select></label><button type="button" onClick={() => onMove(selectedFolder)} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#1d4ed8] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#1e40af] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d4ed8]"><Check className="size-4" />Confirmar</button></div>}<button role="menuitem" onClick={onTrash} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[#dc2626] hover:bg-[#fef2f2]"><Trash2 className="size-4" />Mover para lixeira</button></>}
      </div>}</div></div>
    </div>
  </article>;
}
