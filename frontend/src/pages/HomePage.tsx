import { useRef } from 'react';
import { ArrowRight, Gamepad2, Radio, Trophy, Users } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/Card';
import { Container } from '@/components/layout/Container';
import { Grid } from '@/components/layout/Grid';
import { Section } from '@/components/layout/Section';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { Stack } from '@/components/layout/Stack';
import { JoinGameForm } from '@/components/game/JoinGameForm';

const features = [
  { Icon: Users, title: 'Multiplayer', description: 'Jogue com várias pessoas na mesma partida.' },
  {
    Icon: Radio,
    title: 'Tempo real',
    description: 'Perguntas, respostas e resultados sincronizados durante o jogo.',
  },
  {
    Icon: Trophy,
    title: 'Ranking',
    description: 'Acompanhe sua pontuação e dispute as primeiras posições.',
  },
];

const steps = [
  { number: '01', title: 'Entre na sala', description: 'Digite o PIN da partida e aguarde o início.' },
  {
    number: '02',
    title: 'Responda às perguntas',
    description: 'Cada pergunta tem tempo limitado e resposta ao vivo.',
  },
  { number: '03', title: 'Suba no ranking', description: 'Acertos rápidos valem mais pontos.' },
];

export function HomePage() {
  const pinInputRef = useRef<HTMLInputElement | null>(null);

  const focusPinInput = () => {
    pinInputRef.current?.focus();
    pinInputRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-neutral-900 focus:shadow-lg"
      >
        Pular para o conteúdo
      </a>

      <SiteHeader />

      <main id="conteudo" className="flex flex-1 flex-col">
        <section aria-labelledby="hero-title" className="relative overflow-hidden bg-surface">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-24 -top-32 size-72 rounded-full bg-primary-200/50 blur-3xl sm:size-96"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 top-32 size-64 rounded-full bg-accent-200/40 blur-3xl sm:size-80"
          />

          <Container size="xl" className="relative border-b border-border py-12 sm:py-16 lg:py-24">
            <div className="grid items-start gap-10 lg:grid-cols-3 lg:gap-16">
              <div className="animate-fade-in flex flex-col gap-6 lg:col-span-2 lg:gap-8">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="primary">
                    Quiz multiplayer em tempo real
                  </Badge>
                </div>

                <h1 id="hero-title" className="type-display text-neutral-900 sm:text-5xl lg:text-6xl">
                  Crie. Jogue. <span className="text-primary-600">Compita.</span>
                </h1>

                <p className="type-body-lg max-w-xl text-neutral-600">
                  Uma plataforma de quizzes ao vivo para transformar perguntas em experiências
                  competitivas e divertidas.
                </p>

                <Stack
                  gap="sm"
                  wrap
                  className="flex-col items-stretch sm:flex-row sm:items-center sm:gap-4"
                >
                  <Button size="lg" onClick={focusPinInput}>
                    <Gamepad2 className="size-4" aria-hidden="true" />
                    Jogar agora
                  </Button>
                  <a
                    href="#como-funciona"
                    className="type-label inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-primary-700 underline-offset-4 transition-colors hover:bg-primary-50 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
                  >
                    Ver como funciona
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </a>
                </Stack>

                <p className="type-caption text-neutral-500">
                  Crie uma conta ou entre com e-mail e senha para criar e conduzir quizzes. Para jogar, basta o PIN da sala.
                </p>
              </div>

              <JoinGameForm
                pinInputRef={pinInputRef}
                className="animate-slide-up lg:col-span-1 lg:sticky lg:top-24"
              />
            </div>
          </Container>
        </section>

        <Section className="py-14 sm:py-20">
          <Container size="xl">
            <Stack gap="lg">
              <div className="flex flex-col gap-3">
                <Badge variant="default">Diferenciais</Badge>
                <h2 className="type-h2 text-neutral-900">Feito para jogar junto</h2>
                <p className="type-body-lg max-w-2xl text-neutral-600">
                  Tudo o que uma partida ao vivo precisa, sem ruído.
                </p>
              </div>

              <Grid columns={3}>
                {features.map(({ Icon, title, description }) => (
                  <Card key={title} variant="outlined" className="h-full">
                    <CardContent className="flex h-full flex-col gap-3">
                      <span
                        aria-hidden="true"
                        className="grid size-11 place-items-center rounded-xl bg-primary-50 text-primary-600"
                      >
                        <Icon className="size-5" />
                      </span>
                      <CardTitle>{title}</CardTitle>
                      <CardDescription>{description}</CardDescription>
                    </CardContent>
                  </Card>
                ))}
              </Grid>
            </Stack>
          </Container>
        </Section>

        <Section id="como-funciona" className="scroll-mt-24 pb-14 sm:pb-20">
          <Container size="xl">
            <Stack gap="lg">
              <div className="flex flex-col gap-3">
                <Badge variant="default">Passo a passo</Badge>
                <h2 className="type-h2 text-neutral-900">Como funciona</h2>
                <p className="type-body-lg max-w-2xl text-neutral-600">
                  Três passos até o começo da partida.
                </p>
              </div>

              <Grid columns={3}>
                {steps.map((step) => (
                  <Card key={step.number} className="h-full">
                    <CardContent className="flex h-full flex-col gap-2">
                      <span className="font-display text-3xl font-bold text-primary-500 tabular-nums">
                        {step.number}
                      </span>
                      <CardTitle>{step.title}</CardTitle>
                      <CardDescription>{step.description}</CardDescription>
                    </CardContent>
                  </Card>
                ))}
              </Grid>
            </Stack>
          </Container>
        </Section>

        <section aria-labelledby="criar-quiz-title" className="py-14 sm:py-20">
          <Container size="xl">
            <div className="surface-inverse-card flex flex-col items-start gap-6 p-8 sm:flex-row sm:items-center sm:justify-between sm:p-10">
              <div className="flex flex-col gap-2">
                <h2 id="criar-quiz-title" className="type-h2">
                  Quer criar seu próprio quiz?
                </h2>
                <p className="type-body-lg max-w-lg text-neutral-600">
                  Monte as perguntas, compartilhe o PIN e conduza a partida em tempo real.
                </p>
              </div>
              <ButtonLink to="/criar" size="lg" className="w-full shrink-0 sm:w-auto">
                Criar um quiz
                <ArrowRight className="size-4" aria-hidden="true" />
              </ButtonLink>
            </div>
          </Container>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
