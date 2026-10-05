import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '@/config/environment';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/authStore';

export function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const status = useAuthStore((state) => state.status);
  const [starting, setStarting] = useState(false);
  const params = new URLSearchParams(location.search);
  const requestedReturnTo = params.get('returnTo');
  const returnTo = requestedReturnTo?.startsWith('/') && !requestedReturnTo.startsWith('//') ? requestedReturnTo : '/criar';
  const error = params.get('error') === 'google_login_failed';

  useEffect(() => { if (status === 'authenticated') navigate(returnTo, { replace: true }); }, [status, navigate, returnTo]);
  if (status === 'authenticated') return null;

  const beginLogin = () => {
    setStarting(true);
    window.location.assign(`${API_BASE_URL}/auth/google?returnTo=${encodeURIComponent(returnTo)}`);
  };
  return <main className="grid min-h-screen place-items-center bg-neutral-50 px-4 py-12">
    <section className="w-full max-w-md rounded-2xl border border-border bg-white p-8 shadow-lg sm:p-10" aria-labelledby="login-title">
      <div className="mb-8 text-center"><span className="font-display text-2xl font-extrabold tracking-tight text-primary-700">QUIZ <span className="text-primary-500">SEPLAG</span></span></div>
      <h1 id="login-title" className="type-h2 text-center text-neutral-900">Entre para continuar</h1>
      <p className="type-body mt-3 text-center text-neutral-600">Acesse sua conta para criar quizzes e conduzir partidas.</p>
      {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">Não foi possível entrar com o Google. Tente novamente.</p>}
      <Button className="mt-8 w-full" size="lg" onClick={beginLogin} disabled={starting}>
        <span aria-hidden="true" className="font-bold">G</span>{starting ? 'Conectando…' : 'Continuar com Google'}
      </Button>
      <p className="mt-6 text-center text-xs text-neutral-500">Sua identidade é confirmada com segurança pelo Google.</p>
    </section>
  </main>;
}
