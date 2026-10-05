import { Route, Routes, useSearchParams } from 'react-router-dom';
import {
  ComingSoonPage,
  CreateQuizPage,
  DesignSystemPreview,
  EditQuizQuestionsPage,
  GameLobbyPage,
  HomePage,
  HostGamePage,
  HostLobbyPage,
  JoinGamePage,
  ReviewQuizPage,
  PlayerGamePage,
} from '@/pages';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomeEntryPage />} />
      {/* TEMPORARY — visual validation only, not part of the product */}
      <Route path="/design-system" element={<DesignSystemPreview />} />
      {/* Room entry flow */}
      <Route path="/join" element={<JoinGamePage />} />
      <Route path="/jogar/:pin" element={<JoinGamePage />} />
      <Route path="/jogar/:pin/aguardando" element={<GameLobbyPage />} />
      <Route path="/jogar/:pin/partida" element={<PlayerGamePage />} />
      {/* Quiz creation flow */}
      <Route path="/criar" element={<CreateQuizPage />} />
      <Route path="/criar/:quizId/perguntas" element={<EditQuizQuestionsPage />} />
      <Route path="/criar/:quizId/revisar" element={<ReviewQuizPage />} />
      <Route path="/criar/:quizId/sala" element={<HostLobbyPage />} />
      <Route path="/criar/:quizId/partida" element={<HostGamePage />} />
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

function HomeEntryPage() {
  const [searchParams] = useSearchParams();
  return searchParams.has('pin') ? <JoinGamePage /> : <HomePage />;
}
