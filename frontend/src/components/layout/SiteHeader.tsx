import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { Container } from './Container';
import { Logo } from './Logo';
import { NavLink } from './NavLink';

/**
 * Product chrome used on the public pages: brand, primary navigation and the
 * "Criar quiz" action. Navigation collapses into a menu panel below `sm`.
 */
export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

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
          </nav>
        )}
      </Container>
    </header>
  );
}
