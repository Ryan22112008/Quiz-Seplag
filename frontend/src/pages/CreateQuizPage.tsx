import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/Card';
import { Container } from '@/components/layout/Container';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useQuizStore } from '@/stores/quizStore';
import { QUIZ_CATEGORIES, type Quiz } from '@/types/quiz';
import { baseTextSchema } from '@/lib/validators';

const createQuizSchema = z.object({
  title: baseTextSchema
    .min(3, 'O título deve ter pelo menos 3 caracteres')
    .max(100, 'O título deve ter no máximo 100 caracteres'),
  description: z.string().max(300, 'A descrição deve ter no máximo 300 caracteres').optional(),
  category: z.string().min(1, 'Selecione uma categoria'),
});

type CreateQuizValues = z.infer<typeof createQuizSchema>;

/**
 * Quiz creation page with basic configuration.
 * Route: /criar
 */
export function CreateQuizPage() {
  const navigate = useNavigate();
  const { createQuiz } = useQuizStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateQuizValues>({
    resolver: zodResolver(createQuizSchema),
    mode: 'onTouched',
    defaultValues: {
      title: '',
      description: '',
      category: '',
    },
  });

  const onValidSubmit = (values: CreateQuizValues) => {
    const quizId = `quiz-${Date.now()}`;
    const now = new Date().toISOString();

    const newQuiz: Quiz = {
      id: quizId,
      title: values.title.trim(),
      description: values.description?.trim(),
      category: values.category,
      questions: [],
      createdAt: now,
      updatedAt: now,
    };

    createQuiz(newQuiz);
    navigate(`/criar/${quizId}/perguntas`);
  };

  return (
    <Container size="md" className="min-h-screen py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="type-display text-neutral-900 mb-2">Criar novo quiz</h1>
          <p className="type-body-lg text-neutral-600">
            Configure as informações básicas do seu quiz antes de adicionar as perguntas.
          </p>
        </div>

        <Card variant="elevated">
          <CardHeader>
            <h2 className="type-h2 text-neutral-900">Informações do quiz</h2>
            <CardDescription>
              Preencha os dados abaixo para começar a criar seu quiz.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-6"
              noValidate
              onSubmit={handleSubmit(onValidSubmit)}
            >
              <Input
                {...register('title')}
                label="Título do quiz"
                placeholder="Ex: Conhecimentos Gerais"
                autoComplete="off"
                maxLength={100}
                error={errors.title?.message}
              />

              <Textarea
                {...register('description')}
                label="Descrição (opcional)"
                placeholder="Descreva brevemente o tema do seu quiz..."
                rows={3}
                maxLength={300}
                error={errors.description?.message}
              />

              <Select
                {...register('category')}
                label="Categoria"
                placeholder="Selecione uma categoria"
                options={QUIZ_CATEGORIES}
                error={errors.category?.message}
              />

              <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:justify-end">
                <ButtonLink to="/" variant="outline" size="lg">
                  Cancelar
                </ButtonLink>
                <Button type="submit" size="lg">
                  Continuar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
