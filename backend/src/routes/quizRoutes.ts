import { Router } from 'express';
import type { QuizController } from '../controllers/quizController.js';
export function createQuizRoutes(controller: QuizController) {
  const router = Router();
  router.post('/quizzes', controller.create);
  router.put('/quizzes/:id', controller.update);
  router.patch('/quizzes/:id', controller.update);
  router.post('/quizzes/:id/duplicate', controller.duplicate);
  router.delete('/quizzes/:id', controller.delete);
  router.get('/quizzes/:id', controller.get);
  return router;
}
