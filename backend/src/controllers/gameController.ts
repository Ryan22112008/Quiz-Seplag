import type { RequestHandler } from 'express';
import { DomainError } from '../domain/errors.js';
import type { GameService } from '../services/gameService.js';

type Params = Record<string, string>;
function readPin(value: string | undefined): string {
  if (typeof value !== 'string' || !value) throw new DomainError('INVALID_ROOM_PIN', 400, 'PIN da sala inválido.');
  return value;
}
export class GameController {
  constructor(private readonly gameService: GameService) {}

  start: RequestHandler<Params> = async (request, response, next) => {
    try {
      response.status(201).json(await this.gameService.startGame(readPin(request.params.pin)));
    } catch (error) { next(error); }
  };

  get: RequestHandler<Params> = async (request, response, next) => {
    try {
      response.status(200).json(await this.gameService.getGameState(readPin(request.params.pin)));
    } catch (error) { next(error); }
  };

  finish: RequestHandler<Params> = async (request, response, next) => {
    try {
      response.status(200).json(await this.gameService.finishGame(readPin(request.params.pin)));
    } catch (error) { next(error); }
  };

  startQuestion: RequestHandler<Params> = async (request, response, next) => {
    try {
      const state = await this.gameService.getGame(readPin(request.params.pin));
      response.status(200).json(await this.gameService.startQuestion(state.id));
    } catch (error) { next(error); }
  };

  currentQuestion: RequestHandler<Params> = async (request, response, next) => {
    try {
      response.status(200).json(await this.gameService.getCurrentQuestion(readPin(request.params.pin)));
    } catch (error) { next(error); }
  };

  nextQuestion: RequestHandler<Params> = async (request, response, next) => {
    try {
      const state = await this.gameService.getGame(readPin(request.params.pin));
      response.status(200).json(await this.gameService.nextQuestion(state.id));
    } catch (error) { next(error); }
  };

  answer: RequestHandler<Params> = async (request, response, next) => {
    try {
      const state = await this.gameService.getGame(readPin(request.params.pin));
      response.status(201).json(await this.gameService.submitAnswer(state.id, request.body));
    } catch (error) { next(error); }
  };

  ranking: RequestHandler<Params> = async (request, response, next) => {
    try {
      response.status(200).json(await this.gameService.getRanking(readPin(request.params.pin)));
    } catch (error) { next(error); }
  };
}
