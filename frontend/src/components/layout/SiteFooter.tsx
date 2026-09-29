import { Container } from './Container';
import { Logo } from './Logo';
import { NavLink } from './NavLink';

/** Simple product footer: brand, tagline and the same public navigation. */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-surface">
      <Container size="xl" className="flex flex-col gap-8 py-10 sm:py-12">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2">
            <Logo to={null} />
            <p className="type-body-sm text-neutral-500">Plataforma de quizzes multiplayer</p>
          </div>
          <nav aria-label="Links do rodapé" className="flex flex-wrap items-center gap-1">
            <NavLink to="/" current>
              Início
            </NavLink>
            <NavLink href="#como-funciona">Como funciona</NavLink>
            <NavLink to="/criar">Criar quiz</NavLink>
          </nav>
        </div>
        <p className="type-caption border-t border-border pt-6 text-neutral-400">
          © {year} Quiz SEPLAG
        </p>
      </Container>
    </footer>
  );
}
