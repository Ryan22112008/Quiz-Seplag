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

export const routes = Router();

routes.use(healthRoutes);
const quizRepository = new PrismaQuizRepository(prisma);
const roomRepository = new PrismaRoomRepository(prisma);
const quizService = new QuizService(quizRepository);
const roomService = new RoomService(roomRepository, quizService);
routes.use(createQuizRoutes(new QuizController(quizService)));
routes.use(createRoomRoutes(new RoomController(roomService)));
