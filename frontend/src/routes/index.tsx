import { Navigate, Outlet, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';
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
  ReportsPage,
  ReportDetailPage,
} from '@/pages';
import { AuthenticatedSidebarLayout } from '@/components/layout/AuthenticatedSidebarLayout';
import { useAuthStore } from '@/stores/authStore';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomeEntryPage />} />
      <Route path="/login" element={<LoginPage />} />
      {/* Room entry flow */}
      <Route path="/join" element={<JoinGamePage />} />
      <Route path="/jogar/:pin" element={<JoinGamePage />} />
      <Route path="/jogar/:pin/aguardando" element={<GameLobbyPage />} />
      <Route path="/jogar/:pin/partida" element={<PlayerGamePage />} />
      {/* Quiz creation flow */}
      <Route element={<RequireAuth />}>
        <Route path="/design-system" element={<DesignSystemPreview />} />
        <Route path="/biblioteca" element={<LibraryPage />} />
        <Route path="/descobrir" element={<ComingSoonPage title="Descobrir" description="Estamos preparando uma forma de explorar quizzes disponíveis na plataforma." />} />
        <Route path="/relatorios" element={<ReportsPage />} />
        <Route path="/relatorios/:reportId" element={<ReportDetailPage />} />
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

function HomeEntryPage() {
  const [searchParams] = useSearchParams();
  const status = useAuthStore((state) => state.status);
  if (searchParams.has('pin')) return <JoinGamePage />;
  if (status === 'authenticated') return <AuthenticatedSidebarLayout><HomePage showHeader={false} /></AuthenticatedSidebarLayout>;
  return <HomePage />;
}

function RequireAuth() {
  const status = useAuthStore((state) => state.status);
  const location = useLocation();
  if (status === 'loading') return <main className="grid min-h-screen place-items-center text-neutral-600" role="status">Verificando sua sessão…</main>;
  if (status === 'unauthenticated') return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return <AuthenticatedSidebarLayout><Outlet /></AuthenticatedSidebarLayout>;
}
