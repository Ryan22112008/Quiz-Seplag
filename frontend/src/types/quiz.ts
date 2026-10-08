/** Quiz and question domain types. */

export interface Quiz {
  id: string;
  title: string;
  description?: string;
  category: string;
  questions: QuizQuestion[];
  isDraft?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  imageUrl?: string;
  options: QuizOption[];
  correctOptionId: string;
  timeLimit: number;
  revealTime?: number;
  points: number;
}

export interface QuizOption {
  id: string;
  text: string;
  imageUrl?: string;
}

export const QUIZ_CATEGORIES = [
  { value: 'geral', label: 'Geral' },
  { value: 'conhecimentos-gerais', label: 'Conhecimentos Gerais' },
  { value: 'historia', label: 'História' },
  { value: 'geografia', label: 'Geografia' },
  { value: 'ciencias', label: 'Ciências' },
  { value: 'tecnologia', label: 'Tecnologia' },
  { value: 'esportes', label: 'Esportes' },
  { value: 'cultura', label: 'Cultura' },
];

export const TIME_LIMITS = [
  { value: 10, label: '10 segundos' },
  { value: 15, label: '15 segundos' },
  { value: 20, label: '20 segundos' },
  { value: 30, label: '30 segundos' },
  { value: 60, label: '60 segundos' },
];

export const POINT_VALUES = [
  { value: 100, label: '100 pontos' },
  { value: 200, label: '200 pontos' },
  { value: 500, label: '500 pontos' },
  { value: 1000, label: '1000 pontos' },
];

export const DEFAULT_TIME_LIMIT = 20;
export const DEFAULT_REVEAL_TIME = 5;
export const DEFAULT_POINTS = 1000;
