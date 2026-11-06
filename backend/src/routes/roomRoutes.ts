import { Router, type RequestHandler } from 'express';
import type { RoomController } from '../controllers/roomController.js';

export function createRoomRoutes(roomController: RoomController, requireAuth: RequestHandler) {
  const router = Router();
  router.post('/rooms', requireAuth, roomController.createRoom);
  // Players enter with a room PIN and receive a scoped player token; their
  // mobile browser does not need to send a cross-site account cookie.
  router.get('/rooms/:pin/quiz', roomController.getHostQuiz);
  router.get('/rooms/:pin', roomController.getRoom);
  router.post('/rooms/:pin/players', roomController.joinRoom);
  router.delete('/rooms/:pin/players/:playerId', (_request, response) => response.status(405).json({ error: { code: 'REALTIME_REQUIRED', message: 'Use uma conexão realtime inscrita como jogador para sair da sala.' } }));
  return router;
}
