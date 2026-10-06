import { Router } from 'express';
import type { QuizController } from '../controllers/quizController.js';
import { requireAuth } from '../auth/middleware.js';
export function createQuizRoutes(controller: QuizController) {
  const router = Router();
  router.post('/quizzes', requireAuth, controller.create);
  router.get('/quizzes', requireAuth, controller.list);
  router.put('/quizzes/:id', requireAuth, controller.update);
  router.patch('/quizzes/:id', requireAuth, controller.update);
  router.post('/quizzes/:id/duplicate', requireAuth, controller.duplicate);
  router.delete('/quizzes/:id', requireAuth, controller.delete);
  router.get('/quizzes/:id', requireAuth, controller.get);
  return router;
}
