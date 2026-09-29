import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';

export interface QuizQuestionProps {
  index: number;
  total?: number;
  question: string;
  category?: string;
  points?: number;
  className?: string;
}

/** Presentational question header — number, text and auxiliary metadata only. */
export function QuizQuestion({ index, total, question, category, points, className }: QuizQuestionProps) {
  return (
    <div className={cn('flex w-full flex-col gap-3 text-center', className)}>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Badge variant="primary">
          Pergunta {index}
          {total ? ` de ${total}` : ''}
        </Badge>
        {category && <Badge variant="default">{category}</Badge>}
        {points !== undefined && <Badge variant="neutral">{points} pts</Badge>}
      </div>
      <h2 className="type-h2 mx-auto max-w-3xl text-balance text-neutral-900">{question}</h2>
    </div>
  );
}
