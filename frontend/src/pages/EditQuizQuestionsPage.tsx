import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, ArrowLeft, Home, X } from 'lucide-react';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { Card, CardContent } from '@/components/ui/Card';
import { Container } from '@/components/layout/Container';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Radio } from '@/components/ui/Radio';
import { Textarea } from '@/components/ui/Textarea';
import { useQuizStore } from '@/stores/quizStore';
import {
  TIME_LIMITS,
  POINT_VALUES,
  DEFAULT_TIME_LIMIT,
  DEFAULT_POINTS,
  type QuizQuestion,
} from '@/types/quiz';
import { ImagePicker } from '@/components/quiz/ImagePicker';
import { imageSource } from '@/lib/imageSource';

const questionOptionSchema = z.object({
  id: z.string(),
  text: z.string().max(100, 'Máximo 100 caracteres'),
  imageUrl: z.string().optional(),
}).refine((option) => option.text.trim().length > 0 || Boolean(option.imageUrl), 'Adicione texto ou uma imagem à alternativa');

const questionSchema = z.object({
  question: z.string().trim().max(300, 'Máximo 300 caracteres'),
  imageUrl: z.string().optional(),
  options: z.array(questionOptionSchema).min(2, 'São necessárias pelo menos 2 alternativas').max(8, 'O máximo é 8 alternativas'),
  correctOptionId: z.string().min(1, 'Selecione a resposta correta'),
  timeLimit: z.number(),
  points: z.number(),
}).refine((data) => data.question.trim().length > 0 || Boolean(data.imageUrl), { path: ['question'], message: 'Informe a pergunta ou adicione uma imagem' })
  .refine((data) => data.options.some((option) => option.id === data.correctOptionId), { path: ['correctOptionId'], message: 'Selecione uma alternativa correta' });

type QuestionFormData = z.infer<typeof questionSchema>;

interface QuestionModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: QuestionFormData) => void;
  initialData?: QuizQuestion;
}

function QuestionModal({ open, onClose, onSave, initialData }: QuestionModalProps) {
  const [formData, setFormData] = useState<QuestionFormData>(
    initialData || {
      question: '',
      options: [
        { id: 'opt-1', text: '' },
        { id: 'opt-2', text: '' },
        { id: 'opt-3', text: '' },
        { id: 'opt-4', text: '' },
      ],
      correctOptionId: '',
      timeLimit: DEFAULT_TIME_LIMIT,
      points: DEFAULT_POINTS,
    },
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setFormData(initialData ? { ...initialData, options: initialData.options.map((option) => ({ ...option })) } : {
      question: '', imageUrl: '', options: Array.from({ length: 4 }, (_, index) => ({ id: `opt-${Date.now()}-${index}`, text: '' })),
      correctOptionId: '', timeLimit: DEFAULT_TIME_LIMIT, points: DEFAULT_POINTS,
    });
    setErrors({});
  }, [initialData, open]);

  const handleOptionChange = (index: number, text: string) => {
    const newOptions = [...formData.options];
    newOptions[index] = { ...newOptions[index], text };
    setFormData({ ...formData, options: newOptions });
  };

  const removeOption = (id: string) => setFormData((current) => ({ ...current, options: current.options.filter((option) => option.id !== id), correctOptionId: current.correctOptionId === id ? '' : current.correctOptionId }));

  const handleSave = () => {
    try {
      questionSchema.parse(formData);
      onSave(formData);
      setErrors({});
      onClose();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0] === 'options' && typeof err.path[1] === 'number') newErrors[`option-${err.path[1]}`] = err.message;
          else if (err.path[0]) newErrors[err.path[0] as string] = err.message;
        });
        setErrors(newErrors);
      }
    }
  };

  const optionLabels = 'ABCDEFGH';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialData ? 'Editar pergunta' : 'Adicionar pergunta'}
      description="Configure a pergunta e suas alternativas."
      actions={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>Salvar</Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Textarea
          label="Pergunta"
          placeholder="Digite sua pergunta..."
          rows={3}
          maxLength={300}
          value={formData.question}
          onChange={(e) => setFormData({ ...formData, question: e.target.value })}
          error={errors.question}
        />
        <ImagePicker label="da pergunta" value={formData.imageUrl} onChange={(imageUrl) => setFormData({ ...formData, imageUrl })} />

        <div>
          <label className="type-label mb-3 block text-neutral-700">Alternativas</label>
          <div className="flex flex-col gap-3">
            {formData.options.map((option, index) => (
              <div key={option.id} className="flex flex-wrap items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700 font-display font-bold">
                  {optionLabels[index]}
                </div>
                <div className="w-[calc(100%-3.25rem)] sm:min-w-40 sm:flex-1">
                  <Input
                    placeholder={`Alternativa ${optionLabels[index]}`}
                    value={option.text}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    maxLength={100}
                    error={errors[`option-${index}`]}
                  />
                </div>
                <div className="w-full sm:w-auto">
                  <ImagePicker label={`da alternativa ${optionLabels[index]}`} value={option.imageUrl} onChange={(imageUrl) => setFormData((current) => ({ ...current, options: current.options.map((item) => item.id === option.id ? { ...item, imageUrl } : item) }))} />
                </div>
                <Radio
                  name="correctOption"
                  label="Correta"
                  checked={formData.correctOptionId === option.id}
                  onChange={() => setFormData({ ...formData, correctOptionId: option.id })}
                  className="mt-2"
                />
                <Button variant="ghost" size="icon" disabled={formData.options.length <= 2} aria-label={`Remover alternativa ${optionLabels[index]}`} onClick={() => removeOption(option.id)}><X className="size-4" aria-hidden="true" /></Button>
              </div>
            ))}
          </div>
          <Button className="mt-3" variant="outline" disabled={formData.options.length >= 8} onClick={() => setFormData((current) => ({ ...current, options: [...current.options, { id: `opt-${Date.now()}`, text: '' }] }))}><Plus className="size-4" aria-hidden="true" />Adicionar alternativa</Button>
          {formData.options.length >= 8 && <p className="type-caption mt-2 text-neutral-500">Limite de 8 alternativas.</p>}
          {errors.correctOptionId && (
            <p className="type-caption mt-2 font-medium text-danger-600">{errors.correctOptionId}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Tempo"
            options={TIME_LIMITS.map((t) => ({ value: t.value.toString(), label: t.label }))}
            value={formData.timeLimit.toString()}
            onChange={(e) => setFormData({ ...formData, timeLimit: Number(e.target.value) })}
          />
          <Select
            label="Pontuação"
            options={POINT_VALUES.map((p) => ({ value: p.value.toString(), label: p.label }))}
            value={formData.points.toString()}
            onChange={(e) => setFormData({ ...formData, points: Number(e.target.value) })}
          />
        </div>
      </div>
    </Modal>
  );
}

/**
 * Quiz questions editing page.
 * Route: /criar/:quizId/perguntas
 */
export function EditQuizQuestionsPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const { getQuizById, updateQuiz } = useQuizStore();

  const quiz = quizId ? getQuizById(quizId) : undefined;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | undefined>();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<string | undefined>();

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

  const handleAddQuestion = () => {
    setEditingQuestion(undefined);
    setIsModalOpen(true);
  };

  const handleEditQuestion = (question: QuizQuestion) => {
    setEditingQuestion(question);
    setIsModalOpen(true);
  };

  const handleSaveQuestion = (data: QuestionFormData) => {
    if (!quizId) return;

    const questionId = editingQuestion?.id || `q-${Date.now()}`;
    const newQuestion: QuizQuestion = {
      id: questionId,
      question: data.question.trim(),
      ...(data.imageUrl ? { imageUrl: data.imageUrl } : {}),
      options: data.options.map((opt) => ({ id: opt.id, text: opt.text.trim(), ...(opt.imageUrl ? { imageUrl: opt.imageUrl } : {}) })),
      correctOptionId: data.correctOptionId,
      timeLimit: data.timeLimit,
      points: data.points,
    };

    const updatedQuestions = editingQuestion
      ? quiz.questions.map((q) => (q.id === editingQuestion.id ? newQuestion : q))
      : [...quiz.questions, newQuestion];

    updateQuiz(quizId, { questions: updatedQuestions });
    setIsModalOpen(false);
    setEditingQuestion(undefined);
  };

  const handleDeleteQuestion = (questionId: string) => {
    setQuestionToDelete(questionId);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (!quizId || !questionToDelete) return;

    const updatedQuestions = quiz.questions.filter((q) => q.id !== questionToDelete);
    updateQuiz(quizId, { questions: updatedQuestions });
    setDeleteConfirmOpen(false);
    setQuestionToDelete(undefined);
  };

  const optionLabels = ['A', 'B', 'C', 'D'];

  return (
    <Container size="md" className="min-h-screen py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-4">
          <ButtonLink to="/criar" variant="ghost" size="icon" className="shrink-0">
            <ArrowLeft className="size-5" aria-hidden="true" />
          </ButtonLink>
          <div className="min-w-0">
            <h1 className="type-h2 text-neutral-900 truncate">{quiz.title}</h1>
            <p className="type-body text-neutral-500">
              {quiz.questions.length} {quiz.questions.length === 1 ? 'pergunta' : 'perguntas'}
            </p>
          </div>
        </div>

        {quiz.questions.length === 0 ? (
          <EmptyState
            title="Ainda não há perguntas"
            description="Adicione sua primeira pergunta para começar a montar o quiz."
            action={
              <Button onClick={handleAddQuestion} size="lg">
                <Plus className="size-4" aria-hidden="true" />
                Adicionar pergunta
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-4">
            {quiz.questions.map((question, index) => (
              <Card key={question.id} variant="outlined">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-start gap-3 mb-3">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700 font-display font-bold text-sm">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="type-body-lg font-medium text-neutral-900 mb-2">
                            {question.question}
                          </h3>
                          {question.imageUrl && <img src={imageSource(question.imageUrl)} alt="Imagem da pergunta" className="mb-3 max-h-48 w-full rounded-lg object-contain" />}
                          <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
                            <span className="type-caption text-neutral-500">
                              {question.timeLimit}s · {question.points} pontos
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="ml-11 grid grid-cols-1 gap-1 sm:grid-cols-2">
                        {question.options.map((option, optIndex) => (
                          <div
                            key={option.id}
                            className={`type-body-sm text-neutral-600 ${
                              option.id === question.correctOptionId
                                ? 'font-medium text-success-700'
                                : ''
                            }`}
                          >
                            {optionLabels[optIndex]}) {option.text}{option.imageUrl && <img src={imageSource(option.imageUrl)} alt={`Imagem da alternativa ${optionLabels[optIndex]}`} className="mt-1 max-h-24 max-w-full rounded object-contain" />}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditQuestion(question)}
                        aria-label="Editar pergunta"
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteQuestion(question.id)}
                        aria-label="Excluir pergunta"
                        className="text-danger-600 hover:text-danger-700 hover:bg-danger-50"
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Button onClick={handleAddQuestion} variant="outline" size="lg" className="w-full">
              <Plus className="size-4" aria-hidden="true" />
              Adicionar pergunta
            </Button>
          </div>
        )}

        <div className="mt-8 flex justify-end">
          {quiz.questions.length === 0 ? (
            <Button size="lg" disabled>
              Continuar
            </Button>
          ) : (
            <ButtonLink to={`/criar/${quizId}/revisar`} size="lg">
              Continuar
            </ButtonLink>
          )}
        </div>
      </div>

      <QuestionModal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingQuestion(undefined);
        }}
        onSave={handleSaveQuestion}
        initialData={editingQuestion}
      />

      <Modal
        open={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setQuestionToDelete(undefined);
        }}
        title="Excluir esta pergunta?"
        description="Essa ação não poderá ser desfeita."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteConfirmOpen(false);
                setQuestionToDelete(undefined);
              }}
            >
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              Excluir
            </Button>
          </>
        }
      >
        <></>
      </Modal>
    </Container>
  );
}
