export interface GameReportQuestion {
  id: string; number: number; text: string; type: 'Múltipla escolha' | 'Verdadeiro ou falso';
  answerCount: number; correctCount: number; accuracyRate: number;
  options: Array<{ id: string; text: string; count: number; correct: boolean }>;
}
export interface GameReportParticipant {
  id: string; name: string; position: number; score: number;
  answeredQuestions: number; correctAnswers: number; missedQuestions: number; completed: boolean;
}
export interface GameReport {
  id: string; quizId: string; roomId: string; roomPin: string; startedAt: string; finishedAt: string;
  durationSeconds: number; participantCount: number; questionCount: number; totalAnswers: number;
  correctAnswers: number; accuracyRate: number; deletedAt: string | null;
  details: { quizTitle: string; quizCategory: string; coverImageUrl?: string; questions: GameReportQuestion[]; participants: GameReportParticipant[] };
}
