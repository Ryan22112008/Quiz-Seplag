import { Router } from 'express';
import type { GameController } from '../controllers/gameController.js';

export function createGameRoutes(controller: GameController) {
  const router = Router();
  const realtimeOnly = (_request: import('express').Request, response: import('express').Response) => response.status(405).json({ error: { code: 'REALTIME_REQUIRED', message: 'Use uma conexão realtime inscrita para alterar a partida.' } });
  router.post('/rooms/:pin/start', realtimeOnly);
  router.get('/rooms/:pin/game', controller.get);
  router.post('/rooms/:pin/game/finish', realtimeOnly);
  router.post('/rooms/:pin/game/question/start', realtimeOnly);
  router.get('/rooms/:pin/game/question', controller.currentQuestion);
  router.post('/rooms/:pin/game/question/next', realtimeOnly);
  router.post('/rooms/:pin/game/question/answer', realtimeOnly);
  router.get('/rooms/:pin/game/ranking', controller.ranking);
  return router;
}
