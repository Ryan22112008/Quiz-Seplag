export type DomainErrorCode =
  | 'INVALID_QUIZ'
  | 'QUIZ_NOT_FOUND'
  | 'QUIZ_ID_CONFLICT'
  | 'QUIZ_STORE_ERROR'
  | 'INVALID_QUIZ_ID'
  | 'INVALID_ROOM_PIN'
  | 'ROOM_NOT_FOUND'
  | 'INVALID_PLAYER_NAME'
  | 'PLAYER_ALREADY_EXISTS'
  | 'PLAYER_NOT_FOUND'
  | 'ROOM_NOT_JOINABLE'
  | 'INVALID_ROOM_TRANSITION'
  | 'ROOM_PIN_CONFLICT'
  | 'ROOM_ID_CONFLICT'
  | 'ROOM_STORE_ERROR';

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
