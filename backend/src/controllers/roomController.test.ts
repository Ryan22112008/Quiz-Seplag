import assert from 'node:assert/strict';
import type { Request, Response, RequestHandler } from 'express';
import { describe, it } from 'node:test';
import { DomainError } from '../domain/errors.js';
import { InMemoryQuizRepository } from '../repositories/quizRepository.js';
import { InMemoryRoomRepository } from '../repositories/roomRepository.js';
import { QuizService } from '../services/quizService.js';
import { RoomService } from '../services/roomService.js';
import { RoomController } from './roomController.js';

describe('room-scoped host quiz access', () => {
  it('returns correctOptionId only with the room host capability', async () => {
    const quizzes = new QuizService(new InMemoryQuizRepository());
    const quiz = await quizzes.createQuiz({
      title: 'Quiz seguro', category: 'geral', questions: [{ question: 'Pergunta?', timeLimit: 10, points: 100,
        correctOptionId: 'a', options: ['a', 'b', 'c', 'd'].map((id) => ({ id, text: `Opção ${id}` })) }],
    });
    const rooms = new RoomService(new InMemoryRoomRepository(), quizzes);
    const { room, hostToken } = await rooms.createRoomWithHostToken(quiz.id);
    const controller = new RoomController(rooms, quizzes);

    const request = { params: { pin: room.pin }, header: (name: string) => name.toLowerCase() === 'x-host-token' ? undefined : undefined } as unknown as Request;
    const denied = await invoke(controller.getHostQuiz as RequestHandler, request);
    assert.equal(denied.error instanceof DomainError && denied.error.code, 'FORBIDDEN');

    const authorizedRequest = { ...request, header: (name: string) => name.toLowerCase() === 'x-host-token' ? hostToken : undefined } as Request;
    const authorized = await invoke(controller.getHostQuiz as RequestHandler, authorizedRequest);
    assert.equal(authorized.statusCode, 200);
    assert.equal((authorized.body as typeof quiz).questions[0]?.correctOptionId, quiz.questions[0]?.correctOptionId);
  });
});

async function invoke(handler: RequestHandler, request: Request): Promise<{ statusCode: number; body?: unknown; error?: unknown }> {
  const result: { statusCode: number; body?: unknown; error?: unknown } = { statusCode: 200 };
  const response = {
    status(statusCode: number) { result.statusCode = statusCode; return this; },
    json(body: unknown) { result.body = body; return this; },
  } as unknown as Response;
  await (handler(request, response, (error?: unknown) => { result.error = error; }) as unknown as Promise<void>);
  return result;
}
