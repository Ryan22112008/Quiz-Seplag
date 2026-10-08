import { useState, type ReactNode } from 'react';
import { BookOpen, ChartNoAxesColumn, Home, LogOut, Menu, X, Plus } from 'lucide-react';
import { NavLink as RouterNavLink, Outlet, useNavigate } from 'react-router-dom';
import { Logo } from './Logo';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/authStore';

const navigation = [
  { label: 'Início', to: '/', Icon: Home, end: true },
  { label: 'Biblioteca', to: '/biblioteca', Icon: BookOpen },
  { label: 'Relatórios', to: '/relatorios', Icon: ChartNoAxesColumn },
  { label: 'Criar quiz', to: '/criar', Icon: Plus },
];

export function AuthenticatedSidebarLayout({ children }: { children?: ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const signOut = async () => {
    try { await logout(); setMobileOpen(false); navigate('/', { replace: true }); }
    catch { /* Keep the account visible so logout can be retried. */ }
  };
  const closeMenu = () => setMobileOpen(false);
  const sidebar = <>
    <div className="border-b border-border px-5 py-5"><Logo /></div>
    <nav aria-label="Navegação da conta" className="flex-1 space-y-1 px-3 py-5">
      <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-400">Menu</p>
      {navigation.map(({ label, to, Icon, end }) => <RouterNavLink key={to} to={to} end={end} onClick={closeMenu} className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 ${isActive ? 'bg-primary-700 text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'}`}><Icon className="size-[18px] shrink-0" aria-hidden="true" /><span>{label}</span></RouterNavLink>)}
    </nav>
    <div className="border-t border-border p-4">
      {user && <div className="mb-3 flex min-w-0 items-center gap-2.5 px-1">{user.avatarUrl ? <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" className="size-9 shrink-0 rounded-full object-cover" /> : <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-100 text-sm font-bold text-primary-800">{user.name.slice(0, 1).toUpperCase()}</span>}<span className="min-w-0"><span className="block truncate text-sm font-semibold text-neutral-800">{user.name}</span><span className="block truncate text-xs text-neutral-500">{user.email}</span></span></div>}
      <Button variant="ghost" size="sm" className="w-full justify-start text-neutral-600" onClick={() => void signOut()}><LogOut className="size-4" aria-hidden="true" />Sair</Button>
    </div>
  </>;

  return <div className="min-h-screen bg-neutral-50">
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-surface px-4 lg:hidden">
      <Logo />
      <Button variant="ghost" size="icon" aria-label={mobileOpen ? 'Fechar navegação' : 'Abrir navegação'} aria-expanded={mobileOpen} onClick={() => setMobileOpen((value) => !value)}>{mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}</Button>
    </header>
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-surface lg:flex">{sidebar}</aside>
    {mobileOpen && <><button type="button" aria-label="Fechar navegação" className="fixed inset-0 z-40 bg-neutral-950/40 lg:hidden" onClick={closeMenu} /><aside className="fixed inset-y-0 left-0 z-50 flex w-[min(18rem,86vw)] flex-col border-r border-border bg-surface shadow-xl lg:hidden">{sidebar}</aside></>}
    <div className="min-w-0 lg:ml-64">{children ?? <Outlet />}</div>
  </div>;
}
