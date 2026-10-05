import type { ServerEvent } from '@/types/realtime';
import { useGameStore } from '@/stores/gameStore';
import { useRoomStore } from '@/stores/roomStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useToastStore } from '@/components/ui/useToastStore';
import { useRealtimeStore } from '@/stores/realtimeStore';
import { endRealtimeSession, sendCommand } from './session';

/** The single inbound boundary from server events to domain store actions. */
export function handleServerEvent(event: ServerEvent): void {
  const game = useGameStore.getState();
  const rooms = useRoomStore.getState();

  switch (event.type) {
    case 'ROOM_SUBSCRIBED': useRealtimeStore.getState().setSession({ roomPin: event.payload.roomPin, ...(event.payload.role === 'player' && usePlayerStore.getState().playerId ? { playerId: usePlayerStore.getState().playerId } : {}), role: event.payload.role }); break;
    case 'REALTIME_ERROR':
      useToastStore.getState().push({ variant: 'danger', title: 'Não foi possível concluir a ação', description: friendlyRealtimeMessage(event.payload.code) });
      break;
    case 'ROOM_CREATED': rooms.upsertRoom(event.payload.room); break;
    case 'ROOM_SYNCED': {
      const snapshot = event.payload;
      rooms.upsertRoom(snapshot.room);
      if (!snapshot.game) game.resetGame(snapshot.room.pin);
      else game.syncGame({
        roomPin: snapshot.room.pin, gameId: snapshot.game.id, quizId: snapshot.game.quizId,
        currentQuestionIndex: snapshot.game.currentQuestionIndex, totalQuestions: snapshot.game.totalQuestions,
        gameStatus: snapshot.game.status, phase: snapshot.game.phase, resultsStartedAt: snapshot.game.resultsStartedAt,
        resultsEndsAt: snapshot.game.resultsEndsAt, question: snapshot.game.currentQuestion,
        ranking: snapshot.ranking, hasAnswered: snapshot.hasAnsweredCurrentQuestion, questionEnded: snapshot.questionEnded,
      });
      if (snapshot.game?.status === 'FINISHED') {
        rooms.setRoomStatus(snapshot.room.pin, 'finished');
        const identity = usePlayerStore.getState();
        const own = snapshot.ranking.find((entry) => entry.playerId === identity.playerId);
        if (own) game.setFinalResult(snapshot.room.pin, { score: own.score, position: own.position, totalPlayers: snapshot.ranking.length });
      }
      useRealtimeStore.getState().setSynced();
      if (snapshot.room.status === 'finished' && !snapshot.game) {
        if (usePlayerStore.getState().roomPin === snapshot.room.pin) usePlayerStore.getState().clearPlayer();
        endRealtimeSession();
      } else if (snapshot.room.status !== 'finished' && snapshot.game?.status === 'IN_PROGRESS' && !snapshot.game.currentQuestion && useRealtimeStore.getState().role === 'host') {
        requestFirstQuestion(snapshot.room.pin);
      }
      break;
    }
    case 'PLAYER_JOINED': rooms.addPlayer(event.payload.roomPin, event.payload.player); break;
    case 'PLAYER_LEFT': rooms.removePlayer(event.payload.roomPin, event.payload.playerId); break;
    case 'GAME_STARTED':
      game.startGame(event.payload.quizId, event.payload.roomPin, event.payload.totalQuestions);
      rooms.setRoomStatus(event.payload.roomPin, 'in-progress');
      if (useRealtimeStore.getState().role === 'host') requestFirstQuestion(event.payload.roomPin);
      break;
    case 'QUESTION_STARTED': {
      if (event.payload.question && event.payload.questionEndsAt && event.payload.gameId) {
        const current = useGameStore.getState().games[event.payload.roomPin];
        game.applyQuestion(event.payload.roomPin, event.payload.gameId, current?.quizId ?? rooms.getRoom(event.payload.roomPin)?.quizId ?? '', current?.totalQuestions ?? event.payload.question.questionIndex + 1, event.payload.question);
      }
      break;
    }
    case 'ANSWER_SUBMITTED': {
      const identity = usePlayerStore.getState();
      if (identity.playerId === event.payload.playerId && identity.roomPin === event.payload.roomPin) game.submitAnswer(event.payload.roomPin);
      break;
    }
    case 'QUESTION_ENDED': game.lockQuestion(event.payload.roomPin, event.payload.timedOut); break;
    case 'RANKING_UPDATED': game.setRanking(event.payload.roomPin, event.payload.ranking); break;
    case 'QUESTION_RESULTS': game.setQuestionResults(event.payload.roomPin, event.payload.ranking, event.payload.resultsStartedAt, event.payload.resultsEndsAt); break;
    case 'GAME_FINISHED':
      game.setRanking(event.payload.roomPin, event.payload.ranking);
      {
        const identity = usePlayerStore.getState();
        const own = event.payload.ranking.find((entry) => entry.playerId === identity.playerId);
        if (own) game.setFinalResult(event.payload.roomPin, { score: own.score, position: own.position, totalPlayers: event.payload.ranking.length });
      }
      game.finishGame(event.payload.roomPin, 'animate');
      rooms.setRoomStatus(event.payload.roomPin, 'finished');
      break;
    case 'ROOM_CLOSED':
      rooms.closeRoom(event.payload.roomPin);
      game.finishGame(event.payload.roomPin, 'stable');
      if (usePlayerStore.getState().roomPin === event.payload.roomPin) usePlayerStore.getState().clearPlayer();
      endRealtimeSession();
      break;
    default: assertNever(event);
  }
}

function requestFirstQuestion(roomPin: string): void {
  try { sendCommand({ type: 'START_QUESTION', payload: { roomPin } }); }
  catch (error) { useToastStore.getState().push({ variant: 'danger', title: 'Não foi possível iniciar a pergunta', description: error instanceof Error ? error.message : 'Verifique a conexão.' }); }
}

function friendlyRealtimeMessage(code: string): string {
  const messages: Record<string, string> = {
    ROOM_NOT_FOUND: 'Sala não encontrada. Confira o PIN e tente novamente.',
    INVALID_ROOM_PIN: 'O PIN informado é inválido.',
    ROOM_CLOSED: 'Esta sala já foi encerrada.',
    ROOM_NOT_JOINABLE: 'Esta sala não está aceitando novos jogadores.',
    PLAYER_ALREADY_EXISTS: 'Já existe um jogador com esse nome nesta sala.',
    INVALID_PLAYER_NAME: 'Informe um nome válido para entrar na sala.',
    QUESTION_NOT_EXPIRED: 'A pergunta ainda está em andamento. Tente avançar novamente.',
    QUESTION_EXPIRED: 'O tempo para responder terminou.',
    NOT_SUBSCRIBED: 'A conexão com a sala não está ativa. Entre novamente na sala.',
  };
  return messages[code] ?? 'Não foi possível concluir esta ação. Tente novamente.';
}

function assertNever(value: never): never {
  throw new Error(`Evento realtime não tratado: ${String(value)}`);
}
