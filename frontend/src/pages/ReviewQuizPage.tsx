import { useParams } from 'react-router-dom';
import { ArrowLeft, Home, Edit2, Users, Clock, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Container } from '@/components/layout/Container';
import { useQuizStore } from '@/stores/quizStore';
import { QUIZ_CATEGORIES } from '@/types/quiz';

/**
 * Quiz review page before publishing.
 * Route: /criar/:quizId/revisar
 */
export function ReviewQuizPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const { getQuizById } = useQuizStore();

  const quiz = quizId ? getQuizById(quizId) : undefined;

  if (!quiz) {
    return (
      <Container size="md" className="min-h-screen flex items-center justify-center py-12">
        <Card variant="elevated" className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-6 p-8 text-center">
            <h1 className="type-h2 text-neutral-900">Quiz não encontrado</h1>
            <p className="type-body text-neutral-600">
              O quiz que você está procurando não existe ou foi removido.
            </p>
            <div className="flex flex-col gap-2 w-full">
              <ButtonLink to="/criar" size="lg" className="w-full">
                Criar novo quiz
              </ButtonLink>
              <ButtonLink to="/" variant="outline" size="lg" className="w-full">
                <Home className="size-4" aria-hidden="true" />
                Voltar para o início
              </ButtonLink>
            </div>
          </CardContent>
        </Card>
      </Container>
    );
  }

  const categoryLabel = QUIZ_CATEGORIES.find((cat) => cat.value === quiz.category)?.label || quiz.category;
  const totalTime = quiz.questions.reduce((sum, q) => sum + q.timeLimit, 0);
  const totalPoints = quiz.questions.reduce((sum, q) => sum + q.points, 0);

  const handlePublish = () => {
    // In this step, publishing is not implemented yet
    // This will be connected to backend in future steps
    alert('A criação de sala será implementada na próxima etapa com integração ao backend.');
  };

  return (
    <Container size="md" className="min-h-screen py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-4">
          <ButtonLink to={`/criar/${quizId}/perguntas`} variant="ghost" size="icon" className="shrink-0">
            <ArrowLeft className="size-5" aria-hidden="true" />
          </ButtonLink>
          <div className="min-w-0">
            <h1 className="type-h2 text-neutral-900 truncate">Revisar quiz</h1>
            <p className="type-body text-neutral-500">Verifique tudo antes de publicar</p>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <Card variant="elevated">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <CardTitle className="mb-2">{quiz.title}</CardTitle>
                  {quiz.description && (
                    <CardDescription className="line-clamp-2">{quiz.description}</CardDescription>
                  )}
                </div>
                <Badge variant="default">{categoryLabel}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-neutral-500">
                    <Users className="size-4" aria-hidden="true" />
                    <span className="type-caption">Perguntas</span>
                  </div>
                  <p className="type-h3 text-neutral-900">{quiz.questions.length}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-neutral-500">
                    <Clock className="size-4" aria-hidden="true" />
                    <span className="type-caption">Tempo total</span>
                  </div>
                  <p className="type-h3 text-neutral-900">{totalTime}s</p>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-neutral-500">
                    <Trophy className="size-4" aria-hidden="true" />
                    <span className="type-caption">Pontos máx</span>
                  </div>
                  <p className="type-h3 text-neutral-900">{totalPoints}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardHeader>
              <CardTitle className="type-h3">Resumo das perguntas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                {quiz.questions.map((question, index) => (
                  <div
                    key={question.id}
                    className="flex items-start gap-3 rounded-lg border border-border p-4"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700 font-display font-bold text-sm">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="type-body text-neutral-900 line-clamp-2">{question.question}</p>
                      <p className="type-caption text-neutral-500 mt-1">
                        {question.timeLimit}s · {question.points} pontos
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <div className="flex gap-2">
              <ButtonLink to={`/criar/${quizId}/perguntas`} variant="outline">
                <Edit2 className="size-4" aria-hidden="true" />
                Editar perguntas
              </ButtonLink>
            </div>
            <Button onClick={handlePublish} size="lg" className="w-full sm:w-auto">
              Publicar / Criar sala
            </Button>
          </div>
        </div>
      </div>
    </Container>
  );
}
