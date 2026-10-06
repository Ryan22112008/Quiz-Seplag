import { Navigate, Outlet, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { protectedRouteDecision } from '@/lib/authState.mjs';
import { AuthenticatedHeader } from '@/components/layout/AuthenticatedHeader';
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
  LoginPage,
  LibraryPage,
  VerifyEmailPage,
} from '@/pages';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomeEntryPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/verificar-email" element={<VerifyEmailPage />} />
      {/* Room entry flow */}
      <Route path="/join" element={<JoinGamePage />} />
      <Route path="/jogar/:pin" element={<JoinGamePage />} />
      <Route path="/jogar/:pin/aguardando" element={<GameLobbyPage />} />
      <Route path="/jogar/:pin/partida" element={<PlayerGamePage />} />
      {/* Quiz creation flow */}
      <Route element={<RequireAuth />}>
        <Route path="/design-system" element={<DesignSystemPreview />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/criar" element={<CreateQuizPage />} />
        <Route path="/criar/:quizId/perguntas" element={<EditQuizQuestionsPage />} />
        <Route path="/criar/:quizId/revisar" element={<ReviewQuizPage />} />
        <Route path="/criar/:quizId/sala" element={<HostLobbyPage />} />
        <Route path="/criar/:quizId/partida" element={<HostGamePage />} />
      </Route>
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

function RequireAuth() {
  const status = useAuthStore((state) => state.status);
  const location = useLocation();
  const decision = protectedRouteDecision(status, location.pathname + location.search);
  if (decision.kind === 'loading') return <main className="grid min-h-screen place-items-center text-neutral-600" role="status">Verificando sua sessão…</main>;
  if (decision.kind === 'redirect') return <Navigate to={decision.to} replace />;
  return <><AuthenticatedHeader /><Outlet /></>;
}

function HomeEntryPage() {
  const [searchParams] = useSearchParams();
  return searchParams.has('pin') ? <JoinGamePage /> : <HomePage />;
}
