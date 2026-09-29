import { Route, Routes } from 'react-router-dom';
import {
  ComingSoonPage,
  CreateQuizPage,
  DesignSystemPreview,
  EditQuizQuestionsPage,
  GameLobbyPage,
  HomePage,
  JoinGamePage,
  ReviewQuizPage,
} from '@/pages';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      {/* TEMPORARY — visual validation only, not part of the product */}
      <Route path="/design-system" element={<DesignSystemPreview />} />
      {/* Room entry flow */}
      <Route path="/jogar/:pin" element={<JoinGamePage />} />
      <Route path="/jogar/:pin/aguardando" element={<GameLobbyPage />} />
      {/* Quiz creation flow */}
      <Route path="/criar" element={<CreateQuizPage />} />
      <Route path="/criar/:quizId/perguntas" element={<EditQuizQuestionsPage />} />
      <Route path="/criar/:quizId/revisar" element={<ReviewQuizPage />} />
      <Route
        path="/login"
        element={
          <ComingSoonPage
            title="Login ainda não está disponível"
            description="A autenticação para criar e organizar quizzes chega em uma próxima etapa."
          />
        }
      />
      <Route
        path="*"
        element={
          <ComingSoonPage
            title="Página não encontrada"
            description="O endereço acessado não existe nesta etapa do produto."
          />
        }
      />
    </Routes>
  );
}
