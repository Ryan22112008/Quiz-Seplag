import { Router } from 'express';
import type { QuizController } from '../controllers/quizController.js';
import type { RequestHandler } from 'express';
export function createQuizRoutes(controller: QuizController, requireAuth: RequestHandler) {
  const router = Router();
  router.post('/quizzes', requireAuth, controller.create);
  router.put('/quizzes/:id', requireAuth, controller.update);
  router.patch('/quizzes/:id', requireAuth, controller.update);
  router.post('/quizzes/:id/duplicate', requireAuth, controller.duplicate);
  router.delete('/quizzes/:id', requireAuth, controller.delete);
  router.get('/quizzes/:id', requireAuth, controller.get);
  return router;
}
