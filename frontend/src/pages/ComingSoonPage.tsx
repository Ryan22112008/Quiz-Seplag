import { Construction } from 'lucide-react';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { EmptyState } from '@/components/ui/EmptyState';
import { Container } from '@/components/layout/Container';
import { Logo } from '@/components/layout/Logo';

export interface ComingSoonPageProps {
  title: string;
  description: string;
}

/**
 * TEMPORARY — shared surface for routes that navigation already points to but
 * whose implementation belongs to a later step (login, game room).
 * It shows no mock data: only the honest status of the route.
 */
export function ComingSoonPage({ title, description }: ComingSoonPageProps) {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <header className="border-b border-border bg-surface py-4">
        <Container size="xl">
          <Logo />
        </Container>
      </header>
      <main className="flex flex-1 items-center py-12">
        <Container size="sm">
          <EmptyState
            icon={<Construction className="size-6" />}
            title={title}
            description={description}
            action={
              <ButtonLink to="/" variant="outline" size="lg">
                Voltar para a home
              </ButtonLink>
            }
          />
        </Container>
      </main>
    </div>
  );
}
