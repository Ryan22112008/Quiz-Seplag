import type { RequestHandler } from 'express';
import { DomainError } from '../domain/errors.js';
import type { RoomService } from '../services/roomService.js';

type RouteParams = Record<string, string>;
type JsonBody = unknown;

function readStringField(body: unknown, field: string): string {
  if (typeof body !== 'object' || body === null || !(field in body)) {
    throw new DomainError(field === 'quizId' ? 'INVALID_QUIZ_ID' : 'INVALID_PLAYER_NAME', 400, `Informe ${field}.`);
  }

  const value = (body as Record<string, unknown>)[field];
  if (typeof value !== 'string') {
    throw new DomainError(field === 'quizId' ? 'INVALID_QUIZ_ID' : 'INVALID_PLAYER_NAME', 400, `Informe ${field} como texto.`);
  }
  return value;
}

function readRouteParam(params: RouteParams, field: string): string {
  const value = params[field];
  if (typeof value !== 'string' || value.length === 0) {
    throw new DomainError('INVALID_ROOM_PIN', 400, `Parâmetro ${field} inválido.`);
  }
  return value;
}

export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  createRoom: RequestHandler<RouteParams, unknown, JsonBody> = async (request, response, next) => {
    try {
      const room = await this.roomService.createRoom(readStringField(request.body, 'quizId'));
      response.status(201).json(room);
    } catch (error) {
      next(error);
    }
  };

  getRoom: RequestHandler<RouteParams> = async (request, response, next) => {
    try {
      response.status(200).json(await this.roomService.getRoomByPin(readRouteParam(request.params, 'pin')));
    } catch (error) {
      next(error);
    }
  };

  joinRoom: RequestHandler<RouteParams, unknown, JsonBody> = async (request, response, next) => {
    try {
      const joined = await this.roomService.joinRoom(readRouteParam(request.params, 'pin'), readStringField(request.body, 'name'));
      response.status(201).json(joined);
    } catch (error) {
      next(error);
    }
  };

  leaveRoom: RequestHandler<RouteParams> = async (request, response, next) => {
    try {
      await this.roomService.leaveRoom(
        readRouteParam(request.params, 'pin'),
        readRouteParam(request.params, 'playerId'),
      );
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
