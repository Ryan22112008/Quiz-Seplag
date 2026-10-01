export interface QuizOption { id: string; text: string }
export interface Question {
  id: string;
  question: string;
  options: QuizOption[];
  correctOptionId: string;
  timeLimit: number;
  points: number;
}
export interface Quiz {
  id: string;
  title: string;
  description?: string;
  category: string;
  questions: Question[];
  createdAt: string;
  updatedAt: string;
}
