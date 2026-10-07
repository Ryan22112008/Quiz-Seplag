import { DomainError } from '../domain/errors.js';
import type { Game } from '../domain/game.js';
import type { GameReport, GameReportQuestion, GameReportParticipant } from '../domain/report.js';
import type { GameReportRepository } from '../repositories/reportRepository.js';
import type { GameRepository } from '../repositories/gameRepository.js';
import type { QuizService } from './quizService.js';
import type { RoomService } from './roomService.js';

export class GameReportService {
  constructor(private readonly repository: GameReportRepository, private readonly games: GameRepository, private readonly rooms: Pick<RoomService, 'getRoomById'>, private readonly quizzes: Pick<QuizService, 'getQuizById'>, private readonly now = () => new Date()) {}

  async capture(game: Game): Promise<void> {
    if (game.status !== 'FINISHED') return;
    const [room, quiz, scores, answers] = await Promise.all([
      this.rooms.getRoomById(game.roomId), this.quizzes.getQuizById(game.quizId),
      this.games.listScores(game.id), this.games.listAnswers(game.id),
    ]);
    const scoreByPlayer = new Map(scores.map((score) => [score.playerId, score]));
    const answerByQuestion = groupBy(answers, (answer) => answer.questionId);
    const questionSnapshots: GameReportQuestion[] = quiz.questions.map((question, index) => {
      const responses = answerByQuestion.get(question.id) ?? [];
      const correctCount = responses.filter((answer) => answer.isCorrect).length;
      return {
        id: question.id, number: index + 1, text: question.question,
        type: isTrueFalse(question.options.map((option) => option.text)) ? 'Verdadeiro ou falso' : 'Múltipla escolha',
        answerCount: responses.length, correctCount,
        accuracyRate: responses.length ? Math.round(correctCount / responses.length * 100) : 0,
        options: question.options.map((option) => ({ id: option.id, text: option.text, count: responses.filter((answer) => answer.selectedOptionId === option.id).length, correct: option.id === question.correctOptionId })),
      };
    });
    const participantById = new Map(room.players.map((player) => [player.id, player]));
    for (const score of scores) if (!participantById.has(score.playerId)) participantById.set(score.playerId, { id: score.playerId, name: 'Participante', avatarCharacterId: 'bear', avatarAccessoryId: 'none' });
    const participants = [...participantById.values()].map((player) => {
      const score = scoreByPlayer.get(player.id);
      return { id: player.id, name: player.name, ...(player.email ? { email: player.email } : {}), avatarCharacterId: player.avatarCharacterId ?? 'bear', avatarAccessoryId: player.avatarAccessoryId ?? 'none', score: score?.score ?? 0, answeredQuestions: score?.answeredQuestions ?? 0, correctAnswers: score?.correctAnswers ?? 0, missedQuestions: Math.max(0, quiz.questions.length - (score?.answeredQuestions ?? 0)), completed: (score?.answeredQuestions ?? 0) >= quiz.questions.length };
    }).sort((a, b) => b.score - a.score || b.correctAnswers - a.correctAnswers || a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
      .map((participant, index): GameReportParticipant => ({ ...participant, position: index + 1 }));

    const correctAnswers = answers.filter((answer) => answer.isCorrect).length;
    const finishedAt = game.finishedAt ?? this.now().toISOString();
    const durationSeconds = Math.max(0, Math.round((Date.parse(finishedAt) - Date.parse(game.startedAt)) / 1000));
    await this.repository.save({
      id: game.id, quizId: game.quizId, roomId: room.id, roomPin: room.pin,
      startedAt: game.startedAt, finishedAt, durationSeconds, participantCount: participants.length,
      questionCount: quiz.questions.length, totalAnswers: answers.length, correctAnswers,
      accuracyRate: answers.length ? Math.round(correctAnswers / answers.length * 100) : 0,
      details: { quizTitle: quiz.title, quizCategory: quiz.category, ...(quiz.questions.find((question) => question.imageUrl)?.imageUrl ? { coverImageUrl: quiz.questions.find((question) => question.imageUrl)!.imageUrl } : {}), questions: questionSnapshots, participants }, deletedAt: null,
    });
  }

  async list(ownerId: string, deleted = false): Promise<GameReport[]> { return this.repository.listOwned(ownerId, deleted); }
  async get(id: string, ownerId: string): Promise<GameReport> {
    const report = await this.repository.findOwned(id, ownerId);
    if (!report) throw new DomainError('REPORT_NOT_FOUND', 404, 'Relatório não encontrado.');
    return report;
  }
  async trash(id: string, ownerId: string): Promise<void> {
    if (!await this.repository.setDeleted(id, ownerId, this.now())) throw new DomainError('REPORT_NOT_FOUND', 404, 'Relatório não encontrado.');
  }
  async restore(id: string, ownerId: string): Promise<void> {
    if (!await this.repository.setDeleted(id, ownerId, null)) throw new DomainError('REPORT_NOT_FOUND', 404, 'Relatório não encontrado na lixeira.');
  }
  async permanentlyDelete(id: string, ownerId: string): Promise<void> {
    if (!await this.repository.permanentlyDelete(id, ownerId)) throw new DomainError('REPORT_NOT_FOUND', 404, 'Relatório não encontrado na lixeira.');
  }
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const item of items) { const value = key(item); result.set(value, [...(result.get(value) ?? []), item]); }
  return result;
}
function isTrueFalse(options: string[]): boolean {
  const normalized = options.map((option) => option.trim().toLocaleLowerCase('pt-BR'));
  return normalized.length === 2 && normalized.some((value) => ['verdadeiro', 'true', 'sim'].includes(value)) && normalized.some((value) => ['falso', 'false', 'não', 'nao'].includes(value));
}
