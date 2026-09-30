import type { ServerEvent } from '@/types/realtime';
import { useGameStore } from '@/stores/gameStore';
import { useRoomStore } from '@/stores/roomStore';

/** The single inbound boundary from server events to domain store actions. */
export function handleServerEvent(event: ServerEvent): void {
  const game = useGameStore.getState();
  const rooms = useRoomStore.getState();

  switch (event.type) {
    case 'ROOM_CREATED': rooms.upsertRoom(event.payload.room); break;
    case 'PLAYER_JOINED': rooms.addPlayer(event.payload.roomPin, event.payload.player); break;
    case 'PLAYER_LEFT': rooms.removePlayer(event.payload.roomPin, event.payload.playerId); break;
    case 'GAME_STARTED':
      game.startGame(event.payload.quizId, event.payload.roomPin, event.payload.totalQuestions);
      rooms.setRoomStatus(event.payload.roomPin, 'in-progress');
      break;
    case 'QUESTION_STARTED': {
      const current = useGameStore.getState().games[event.payload.roomPin];
      const remainingSeconds = Math.max(0, (event.payload.endsAt - Date.now()) / 1000);
      game.startQuestion(event.payload.roomPin, remainingSeconds, event.payload.questionIndex);
      if (current && remainingSeconds === 0) game.lockQuestion(event.payload.roomPin, true);
      break;
    }
    case 'ANSWER_SUBMITTED':
      if (event.payload.statistics) game.setQuestionStatistics(event.payload.roomPin, event.payload.statistics);
      break;
    case 'QUESTION_ENDED': game.lockQuestion(event.payload.roomPin, event.payload.timedOut); break;
    case 'QUESTION_RESULT':
      game.setQuestionResult(event.payload.roomPin, event.payload.result);
      if (event.payload.statistics) game.setQuestionStatistics(event.payload.roomPin, event.payload.statistics);
      break;
    case 'RANKING_UPDATED': game.setRanking(event.payload.roomPin, event.payload.ranking); break;
    case 'GAME_FINISHED':
      if (event.payload.result) game.setFinalResult(event.payload.roomPin, event.payload.result);
      if (event.payload.statistics) game.setFinalStatistics(event.payload.roomPin, event.payload.statistics);
      if (event.payload.ranking) game.setRanking(event.payload.roomPin, event.payload.ranking);
      game.finishGame(event.payload.roomPin);
      rooms.setRoomStatus(event.payload.roomPin, 'finished');
      break;
    case 'ROOM_CLOSED':
      rooms.closeRoom(event.payload.roomPin);
      game.finishGame(event.payload.roomPin);
      break;
    default: assertNever(event);
  }
}

function assertNever(value: never): never {
  throw new Error(`Evento realtime não tratado: ${String(value)}`);
}
