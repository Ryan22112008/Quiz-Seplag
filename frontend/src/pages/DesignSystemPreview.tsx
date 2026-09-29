import { useState } from 'react';
import { AlertTriangle, Bell, ChevronDown, Pencil, Settings, Trash2 } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { Dropdown } from '@/components/ui/Dropdown';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Progress } from '@/components/ui/Progress';
import { Radio } from '@/components/ui/Radio';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { Switch } from '@/components/ui/Switch';
import { Tabs } from '@/components/ui/Tabs';
import { Textarea } from '@/components/ui/Textarea';
import { Toasts } from '@/components/ui/Toast';
import { useToastStore } from '@/components/ui/useToastStore';
import { Tooltip } from '@/components/ui/Tooltip';
import { Container } from '@/components/layout/Container';
import { Grid } from '@/components/layout/Grid';
import { PageHeader } from '@/components/layout/PageHeader';
import { Section } from '@/components/layout/Section';
import { Stack } from '@/components/layout/Stack';
import { GamePin, GameProgress, GameStatus, PlayerCount } from '@/components/game';
import { QuizOption, QuizQuestion, RankingItem, Score, Timer } from '@/components/quiz';

/**
 * TEMPORARY validation page — NOT part of the final product.
 * Exists only to visually verify the design system tokens/components.
 */
export function DesignSystemPreview() {
  const [modalOpen, setModalOpen] = useState(false);
  const [tab, setTab] = useState('conta');
  const [switchOn, setSwitchOn] = useState(true);
  const pushToast = useToastStore((state) => state.push);

  return (
    <div className="min-h-screen bg-neutral-50 pb-20">
      <Container size="xl" className="flex flex-col gap-8 py-8 sm:py-12">
        <PageHeader
          title="Design System Preview"
          description="Página temporária para validação visual — não faz parte do produto final."
          actions={
            <Button variant="outline" onClick={() => setModalOpen(true)}>
              Abrir modal
            </Button>
          }
        />

        <Section title="Tipografia" description="Hierarquia type-* definida em index.css">
          <Card>
            <CardContent className="flex flex-col gap-2">
              <p className="type-display">Display — Quiz em tempo real</p>
              <p className="type-h1">H1 — Título principal</p>
              <p className="type-h2">H2 — Subtítulo de seção</p>
              <p className="type-h3">H3 — Título de card</p>
              <p className="type-h4">H4 — Título compacto</p>
              <p className="type-body-lg">Body large — texto de destaque.</p>
              <p className="type-body">Body — texto padrão da interface.</p>
              <p className="type-body-sm">Body small — textos auxiliares.</p>
              <p className="type-caption">Caption — metadados</p>
              <p className="type-label">Label — rótulos de formulário</p>
            </CardContent>
          </Card>
        </Section>

        <Section title="Cores" description="Tokens primary / accent / success / warning / danger / neutral">
          <Grid columns={3}>
            <Swatch title="Primary" swatch="bg-primary-600" text="text-primary-700" />
            <Swatch title="Accent" swatch="bg-accent-500" text="text-accent-700" />
            <Swatch title="Success" swatch="bg-success-600" text="text-success-700" />
            <Swatch title="Warning" swatch="bg-warning-500" text="text-warning-700" />
            <Swatch title="Danger" swatch="bg-danger-600" text="text-danger-700" />
            <Swatch title="Neutral" swatch="bg-neutral-900" text="text-neutral-700" />
          </Grid>
        </Section>

        <Section title="Buttons">
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3">
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
              <Button variant="success">Success</Button>
              <Button variant="primary" size="sm">Small</Button>
              <Button variant="primary" size="lg">Large</Button>
              <Button variant="primary" loading>Loading</Button>
              <Button variant="primary" disabled>Disabled</Button>
              <Button variant="outline" size="icon" aria-label="Configurações">
                <Settings className="size-4" />
              </Button>
            </CardContent>
          </Card>
        </Section>

        <Section title="Formularios">
          <Grid columns={2}>
            <Card>
              <CardHeader>
                <CardTitle>Inputs</CardTitle>
                <CardDescription>Label, helper, erro e disabled.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <Input label="Nome do quiz" placeholder="Ex.: Tecnologia" helperText="Minimo de 3 caracteres." />
                <Input label="Com erro" defaultValue="abc" error="Campo obrigatorio." />
                <Input label="Desabilitado" placeholder="Indisponivel" disabled />
                <Textarea label="Descricao" placeholder="Descreva o quiz…" />
                <Select
                  label="Categoria"
                  placeholder="Selecione…"
                  defaultValue=""
                  options={[
                    { value: 'tech', label: 'Tecnologia' },
                    { value: 'sport', label: 'Esporte' },
                    { value: 'geo', label: 'Geografia', disabled: true },
                  ]}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Selecao</CardTitle>
                <CardDescription>Checkbox, radio e switch.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <Checkbox label="Aceito as regras" defaultChecked />
                <Checkbox label="Com erro" error="Confirmacao obrigatoria." />
                <Radio name="preview" label="Opcao A" defaultChecked />
                <Radio name="preview" label="Opcao B" />
                <Switch label="Entrada tardia" checked={switchOn} onCheckedChange={setSwitchOn} />
                <Tabs
                  tabs={[
                    { id: 'conta', label: 'Conta' },
                    { id: 'jogos', label: 'Jogos' },
                    { id: 'plano', label: 'Plano', disabled: true },
                  ]}
                  activeId={tab}
                  onChange={setTab}
                />
              </CardContent>
            </Card>
          </Grid>
        </Section>

        <Section title="Cards e badges">
          <Grid columns={3}>
            <Card>
              <CardHeader>
                <CardTitle>Badges</CardTitle>
                <CardDescription>Variantes semanticas.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Badge>default</Badge>
                  <Badge variant="primary">primary</Badge>
                  <Badge variant="success">success</Badge>
                  <Badge variant="warning">warning</Badge>
                  <Badge variant="danger">danger</Badge>
                  <Badge variant="neutral">neutral</Badge>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" size="sm">Detalhes</Button>
              </CardFooter>
            </Card>
            <Card variant="interactive">
              <CardContent className="flex items-center gap-3">
                <Avatar name="Ada Lovelace" />
                <Avatar name="Alan Turing" size="lg" />
                <Avatar name="Grace Hopper" size="xl" />
              </CardContent>
            </Card>
            <Card variant="elevated">
              <CardContent className="flex flex-col gap-3">
                <Tooltip content="Dica acessivel por hover e foco">
                  <Button variant="secondary" size="sm">Passe o mouse</Button>
                </Tooltip>
                <Dropdown
                  trigger={
                    <Button variant="outline" size="sm">
                      Abrir menu <ChevronDown className="size-4" />
                    </Button>
                  }
                  items={[
                    { id: 'edit', label: 'Editar', icon: <Pencil className="size-4" /> },
                    { id: 'sep', separator: true },
                    { id: 'delete', label: 'Excluir', danger: true, icon: <Trash2 className="size-4" /> },
                  ]}
                />
                <Button variant="ghost" size="sm" onClick={() => pushToast({ variant: 'success', title: 'Toast' })}>
                  <Bell className="size-4" /> Disparar toast
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Section>

        <Section title="Feedback">
          <Stack gap="md">
            <Alert variant="info" title="Info">Mensagem informativa.</Alert>
            <Alert variant="success" title="Sucesso">Resposta correta.</Alert>
            <Alert variant="warning" title="Atencao">Tempo acabando.</Alert>
            <Alert variant="danger" title="Erro">Resposta incorreta.</Alert>
            <Card>
              <CardContent className="flex flex-col gap-4">
                <Progress value={65} showLabel label="Progresso" />
                <Progress value={92} tone="success" label="Acertos" />
                <Progress value={20} tone="danger" label="Erros" />
                <div className="flex items-center gap-4">
                  <Spinner size="sm" /> <Spinner /> <Spinner size="lg" />
                </div>
                <Skeleton className="h-10 w-full" />
                <Skeleton lines={3} />
              </CardContent>
            </Card>
            <EmptyState
              title="Nenhum quiz ainda"
              description="Crie o primeiro quiz para comecar."
              icon={<AlertTriangle className="size-6" />}
              action={<Button size="sm">Criar quiz</Button>}
            />
          </Stack>
        </Section>

        <Section title="Quiz visual">
          <Grid columns={2}>
            <Card>
              <CardContent className="flex flex-col items-center gap-4">
                <QuizQuestion index={3} total={10} question="Qual linguagem estiliza interfaces web?" category="Tecnologia" points={1000} />
                <Timer duration={20} />
                <div className="grid w-full gap-2">
                  <QuizOption label="A" text="HTML" state="default" />
                  <QuizOption label="B" text="CSS" state="selected" selected />
                  <QuizOption label="C" text="CSS (correta)" state="correct" />
                  <QuizOption label="D" text="SQL (incorreta)" state="incorrect" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col gap-4">
                <Score value={12500} highlight size="lg" />
                <ol className="flex flex-col gap-2">
                  <RankingItem position={1} name="Ada Lovelace" score={12500} highlighted streak={5} />
                  <RankingItem position={2} name="Alan Turing" score={11200} />
                  <RankingItem position={3} name="Grace Hopper" score={9800} />
                  <RankingItem position={4} name="Linus Torvalds" score={8400} />
                </ol>
              </CardContent>
            </Card>
          </Grid>
        </Section>

        <Section title="Game visual">
          <Card>
            <CardContent className="flex flex-col items-center gap-4">
              <div className="flex flex-wrap items-center justify-center gap-3">
                <PlayerCount count={12} max={30} />
                <GameStatus status="waiting" />
                <GameStatus status="playing" />
                <GameStatus status="paused" />
                <GameStatus status="finished" />
              </div>
              <GamePin pin="482913" />
              <GameProgress current={4} total={10} />
            </CardContent>
          </Card>
        </Section>
      </Container>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Modal de exemplo"
        description="Overlay, Escape para fechar e acoes."
        actions={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={() => setModalOpen(false)}>Confirmar</Button>
          </>
        }
      >
        <p className="type-body text-neutral-600">Conteudo do dialogo.</p>
      </Modal>

      <Toasts />
    </div>
  );
}

function Swatch({ title, swatch, text }: { title: string; swatch: string; text: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <span className={`size-10 shrink-0 rounded-xl ${swatch}`} aria-hidden="true" />
        <span className="flex flex-col">
          <span className="type-label text-neutral-900">{title}</span>
          <span className={`type-caption font-medium ${text}`}>Token centralizado</span>
        </span>
      </CardContent>
    </Card>
  );
}



