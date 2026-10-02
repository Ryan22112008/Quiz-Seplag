import { Router } from 'express';
import type { GameController } from '../controllers/gameController.js';

export function createGameRoutes(controller: GameController) {
  const router = Router();
  router.post('/rooms/:pin/start', controller.start);
  router.get('/rooms/:pin/game', controller.get);
  router.post('/rooms/:pin/game/finish', controller.finish);
  router.post('/rooms/:pin/game/question/start', controller.startQuestion);
  router.get('/rooms/:pin/game/question', controller.currentQuestion);
  router.post('/rooms/:pin/game/question/next', controller.nextQuestion);
  router.post('/rooms/:pin/game/question/answer', controller.answer);
  router.get('/rooms/:pin/game/ranking', controller.ranking);
  return router;
}
