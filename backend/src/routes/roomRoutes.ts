import { Router } from 'express';
import type { RoomController } from '../controllers/roomController.js';

export function createRoomRoutes(roomController: RoomController) {
  const router = Router();
  router.post('/rooms', roomController.createRoom);
  router.get('/rooms/:pin', roomController.getRoom);
  router.post('/rooms/:pin/players', roomController.joinRoom);
  router.delete('/rooms/:pin/players/:playerId', roomController.leaveRoom);
  return router;
}
