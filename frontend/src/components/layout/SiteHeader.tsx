import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { Container } from './Container';
import { Logo } from './Logo';
import { NavLink } from './NavLink';
import { useAuthStore } from '@/stores/authStore';
import { useNavigate } from 'react-router-dom';

/**
 * Product chrome used on the public pages: brand, primary navigation and the
 * "Criar quiz" action. Navigation collapses into a menu panel below `sm`.
 */
export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const handleLogout = async () => { try { await logout(); navigate('/login', { replace: true }); } catch { /* retain the current user when logout fails */ } };

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
      <Container size="xl">
        <div className="flex h-16 items-center justify-between gap-3">
          <Logo />

          <nav aria-label="Navegação principal" className="hidden items-center gap-1 sm:flex">
            <NavLink href="#como-funciona">Como funciona</NavLink>
            <ButtonLink to="/criar" size="sm" className="ml-2">
              Criar quiz
            </ButtonLink>
            {user ? <div className="ml-4 flex items-center gap-2 border-l border-border pl-4">
              {user.avatarUrl ? <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" className="size-8 rounded-full" /> : <span className="grid size-8 place-items-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">{user.name.slice(0, 1).toUpperCase()}</span>}
              <span className="max-w-36 truncate text-sm font-medium text-neutral-700" title={user.email}>{user.name}</span>
              <Button variant="ghost" size="sm" onClick={() => void handleLogout()}>Sair</Button>
            </div> : <ButtonLink to="/login" variant="ghost" size="sm" className="ml-2">Entrar</ButtonLink>}
          </nav>

          <Button
            variant="ghost"
            size="icon"
            className="text-neutral-700 sm:hidden"
            aria-expanded={menuOpen}
            aria-controls="navegacao-movel"
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>

        {menuOpen && (
          <nav
            id="navegacao-movel"
            aria-label="Navegação principal"
            className="animate-slide-up flex flex-col gap-1 border-t border-border py-3 sm:hidden"
          >
            <NavLink href="#como-funciona" onClick={() => setMenuOpen(false)}>
              Como funciona
            </NavLink>
            <ButtonLink to="/criar" size="md" className="mt-1 w-full" onClick={() => setMenuOpen(false)}>
              Criar quiz
            </ButtonLink>
            {user ? <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <div className="flex min-w-0 items-center gap-2">{user.avatarUrl && <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" className="size-8 rounded-full" />}<span className="truncate text-sm text-neutral-700">{user.name}</span></div>
              <Button variant="ghost" size="sm" onClick={() => { setMenuOpen(false); void handleLogout(); }}>Sair</Button>
            </div> : <ButtonLink to="/login" size="md" variant="outline" className="mt-1 w-full" onClick={() => setMenuOpen(false)}>Entrar</ButtonLink>}
          </nav>
        )}
      </Container>
    </header>
  );
}
