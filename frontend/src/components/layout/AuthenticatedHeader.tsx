import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Logo } from './Logo';
import { useAuthStore } from '@/stores/authStore';

export function AuthenticatedHeader() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const signOut = async () => { try { await logout(); navigate('/', { replace: true }); } catch { /* Keep the account visible so logout can be retried. */ } };
  return <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur"><div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6"><Logo />{user && <div className="flex min-w-0 items-center gap-1 sm:gap-2"><Link to="/biblioteca" className="rounded-lg px-2 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 hover:text-primary-800 sm:px-3 sm:text-sm">Biblioteca</Link><Link to="/relatorios" className="rounded-lg px-2 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 hover:text-primary-800 sm:px-3 sm:text-sm">Relatórios</Link>{user.avatarUrl ? <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" className="size-8 rounded-full" /> : <span className="grid size-8 place-items-center rounded-full bg-primary-100 text-sm font-semibold text-primary-800">{user.name.slice(0, 1).toUpperCase()}</span>}<span className="hidden max-w-48 truncate text-sm text-neutral-700 sm:inline" title={user.email}>{user.name}</span><Button variant="ghost" size="sm" onClick={() => void signOut()}>Sair</Button></div>}</div></header>;
}
