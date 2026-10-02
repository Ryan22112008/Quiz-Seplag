import type { ServerEvent } from '@/types/realtime';
import { useGameStore } from '@/stores/gameStore';
import { useRoomStore } from '@/stores/roomStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useToastStore } from '@/components/ui/useToastStore';

/** The single inbound boundary from server events to domain store actions. */
export function handleServerEvent(event: ServerEvent): void {
  const game = useGameStore.getState();
  const rooms = useRoomStore.getState();

  switch (event.type) {
    case 'ROOM_SUBSCRIBED': break;
    case 'REALTIME_ERROR':
      useToastStore.getState().push({ variant: 'danger', title: 'Não foi possível concluir a ação', description: friendlyRealtimeMessage(event.payload.code) });
      break;
    case 'ROOM_CREATED': rooms.upsertRoom(event.payload.room); break;
    case 'PLAYER_JOINED': rooms.addPlayer(event.payload.roomPin, event.payload.player); break;
    case 'PLAYER_LEFT': rooms.removePlayer(event.payload.roomPin, event.payload.playerId); break;
    case 'GAME_STARTED':
      game.startGame(event.payload.quizId, event.payload.roomPin, event.payload.totalQuestions);
      rooms.setRoomStatus(event.payload.roomPin, 'in-progress');
      break;
    case 'QUESTION_STARTED': {
      if (event.payload.question && event.payload.questionEndsAt && event.payload.gameId) {
        const current = useGameStore.getState().games[event.payload.roomPin];
        game.applyQuestion(event.payload.roomPin, event.payload.gameId, current?.quizId ?? rooms.getRoom(event.payload.roomPin)?.quizId ?? '', current?.totalQuestions ?? event.payload.question.questionIndex + 1, event.payload.question);
      }
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
      if (event.payload.ranking) {
        game.setRanking(event.payload.roomPin, event.payload.ranking);
        const identity = usePlayerStore.getState();
        const own = event.payload.ranking.find((entry) => entry.playerId === identity.playerId);
        if (own) game.setFinalResult(event.payload.roomPin, { score: own.score, position: own.position, totalPlayers: event.payload.ranking.length });
      }
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

function friendlyRealtimeMessage(code: string): string {
  const messages: Record<string, string> = {
    ROOM_NOT_FOUND: 'Sala não encontrada. Confira o PIN e tente novamente.',
    INVALID_ROOM_PIN: 'O PIN informado é inválido.',
    ROOM_CLOSED: 'Esta sala já foi encerrada.',
    ROOM_NOT_JOINABLE: 'Esta sala não está aceitando novos jogadores.',
    DUPLICATE_PLAYER_NAME: 'Já existe um jogador com esse nome nesta sala.',
    INVALID_PLAYER_NAME: 'Informe um nome válido para entrar na sala.',
    QUESTION_NOT_EXPIRED: 'Aguarde o timer chegar a zero antes de avançar.',
    QUESTION_EXPIRED: 'O tempo para responder terminou.',
    NOT_SUBSCRIBED: 'A conexão com a sala não está ativa. Entre novamente na sala.',
  };
  return messages[code] ?? 'O servidor não conseguiu concluir a ação. Tente novamente.';
}

function assertNever(value: never): never {
  throw new Error(`Evento realtime não tratado: ${String(value)}`);
}
