import { Router } from 'express';
import type { RoomController } from '../controllers/roomController.js';
import type { QuizService } from '../services/quizService.js';
import { requireAuth } from '../auth/middleware.js';

export function createRoomRoutes(roomController: RoomController, quizService?: QuizService) {
  const router = Router();
  router.post('/rooms', requireAuth, async (request, response, next) => {
    try {
      const quizId = (request.body as { quizId?: unknown })?.quizId;
      if (typeof quizId !== 'string' || !quizService || !await quizService.canUseQuiz(quizId, request.auth!.user.id)) { response.status(403).json({ error: { code: 'FORBIDDEN', message: 'Você não tem autorização para usar este quiz.' } }); return; }
      roomController.createRoom(request as Parameters<typeof roomController.createRoom>[0], response, next);
    } catch (error) { next(error); }
  });
  router.get('/rooms/:pin/quiz', requireAuth, roomController.getHostQuiz);
  router.get('/rooms/:pin', roomController.getRoom);
  router.post('/rooms/:pin/players', roomController.joinRoom);
  router.delete('/rooms/:pin/players/:playerId', (_request, response) => response.status(405).json({ error: { code: 'REALTIME_REQUIRED', message: 'Use uma conexão realtime inscrita como jogador para sair da sala.' } }));
  return router;
}
