import { Router } from 'express';
import { healthRoutes } from './healthRoutes.js';
import { createRoomRoutes } from './roomRoutes.js';
import { createQuizRoutes } from './quizRoutes.js';
import { QuizController } from '../controllers/quizController.js';
import { RoomController } from '../controllers/roomController.js';
import { PrismaQuizRepository } from '../repositories/quizRepository.js';
import { PrismaRoomRepository } from '../repositories/roomRepository.js';
import { QuizService } from '../services/quizService.js';
import { RoomService } from '../services/roomService.js';
import { prisma } from '../lib/prisma.js';
import { InMemoryGameRepository } from '../repositories/gameRepository.js';
import { GameService } from '../services/gameService.js';
import { GameController } from '../controllers/gameController.js';
import { createGameRoutes } from './gameRoutes.js';

export const routes = Router();

routes.use(healthRoutes);
const quizRepository = new PrismaQuizRepository(prisma);
const roomRepository = new PrismaRoomRepository(prisma);
export const quizService = new QuizService(quizRepository);
export const roomService = new RoomService(roomRepository, quizService);
export const gameService = new GameService(new InMemoryGameRepository(), roomService, quizService);
routes.use(createQuizRoutes(new QuizController(quizService)));
routes.use(createRoomRoutes(new RoomController(roomService, quizService)));
routes.use(createGameRoutes(new GameController(gameService)));
