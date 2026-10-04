import { create } from 'zustand';
import type { Quiz } from '@/types/quiz';

interface QuizStore {
  quizzes: Quiz[];

  createQuiz: (quiz: Quiz) => void;
  upsertQuiz: (quiz: Quiz) => void;
  updateQuiz: (id: string, quiz: Partial<Quiz>) => void;
  deleteQuiz: (id: string) => void;
  getQuizById: (id: string) => Quiz | undefined;
}

/**
 * Quiz store for frontend state management.
 * Stores quizzes locally without backend integration.
 */
export const useQuizStore = create<QuizStore>((set, get) => ({
  quizzes: [],

  createQuiz: (quiz) => {
    set((state) => ({
      quizzes: [...state.quizzes, quiz],
    }));
  },

  upsertQuiz: (quiz) => set((state) => ({ quizzes: [...state.quizzes.filter((item) => item.id !== quiz.id), quiz] })),

  updateQuiz: (id, updatedQuiz) => {
    set((state) => ({
      quizzes: state.quizzes.map((quiz) =>
        quiz.id === id ? { ...quiz, ...updatedQuiz, updatedAt: new Date().toISOString() } : quiz,
      ),
    }));
  },

  deleteQuiz: (id) => {
    set((state) => ({
      quizzes: state.quizzes.filter((quiz) => quiz.id !== id),
    }));
  },

  getQuizById: (id) => {
    return get().quizzes.find((quiz) => quiz.id === id);
  },
}));
