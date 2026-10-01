import { Router } from 'express';
import type { QuizController } from '../controllers/quizController.js';
export function createQuizRoutes(controller: QuizController) {
  const router = Router();
  router.post('/quizzes', controller.create);
  router.get('/quizzes', controller.list);
  router.get('/quizzes/:id', controller.get);
  return router;
}
