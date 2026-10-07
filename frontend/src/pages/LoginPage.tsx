import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { Input } from '@/components/ui/Input';
import { API_BASE_URL } from '@/config/environment';
import { useAuthStore } from '@/stores/authStore';

type Mode = 'login' | 'register';
export function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const status = useAuthStore((state) => state.status);
  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const params = new URLSearchParams(location.search);
  const returnToParam = params.get('returnTo');
  const returnTo = returnToParam?.startsWith('/') && !returnToParam.startsWith('//') ? returnToParam : '/';

  useEffect(() => { void fetch(`${API_BASE_URL}/auth/providers`).then((response) => response.json()).then((data: { google?: boolean }) => setGoogleEnabled(data.google === true)).catch(() => setGoogleEnabled(false)); }, []);
  useEffect(() => { if (status === 'authenticated') navigate(returnTo, { replace: true }); }, [status, navigate, returnTo]);

  if (status === 'loading') return <main className="grid min-h-screen place-items-center text-neutral-600" role="status">Verificando sua sessão…</main>;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError('');
    if (mode === 'register' && password !== confirmation) { setError('As senhas não coincidem.'); return; }
    setBusy(true);
    try { if (mode === 'login') await login(email, password); else await register(email, password); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível concluir.'); }
    finally { setBusy(false); }
  };

  const googleLogin = () => {
    setBusy(true);
    window.location.assign(`${API_BASE_URL}/auth/google?returnTo=${encodeURIComponent(returnTo)}`);
  };

  return <main className="grid min-h-screen place-items-center bg-neutral-50 px-4 py-12">
    <section className="w-full max-w-md rounded-2xl border border-border bg-surface p-7 shadow-xl sm:p-9" aria-labelledby="auth-title">
      <div className="mb-7 text-center"><ButtonLink to="/" variant="ghost" className="font-display text-2xl font-extrabold tracking-tight text-primary-700">QUIZ <span className="text-primary-500">SEPLAG</span></ButtonLink></div>
      <h1 id="auth-title" className="type-h2 text-center text-neutral-900">{mode === 'login' ? 'Fazer login' : 'Criar conta'}</h1>
      <p className="type-body mt-2 text-center text-neutral-600">{mode === 'login' ? 'Entre para criar e gerenciar seus quizzes.' : 'Crie sua conta para começar a usar a plataforma.'}</p>
      {params.get('error') === 'google_login_failed' && <p role="alert" className="mt-5 rounded-lg border border-danger-500/30 bg-danger-50 p-3 text-sm text-danger-700">Não foi possível entrar com o Google. Verifique as credenciais e tente novamente.</p>}
      {error && <p role="alert" className="mt-5 rounded-lg border border-danger-500/30 bg-danger-50 p-3 text-sm text-danger-700">{error}</p>}
      <form className="mt-6 flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
        <Input label="E-mail" type="email" autoComplete="email" required maxLength={191} value={email} onChange={(event) => setEmail(event.target.value)} />
        <Input label="Senha" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={10} maxLength={128} helperText={mode === 'register' ? 'Use pelo menos 10 caracteres.' : undefined} value={password} onChange={(event) => setPassword(event.target.value)} />
        {mode === 'register' && <Input label="Confirme a senha" type="password" autoComplete="new-password" required minLength={10} maxLength={128} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />}
        <Button className="mt-1 w-full" type="submit" size="lg" disabled={busy}>{busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}</Button>
      </form>
      {googleEnabled && <>
        <div className="my-5 flex items-center gap-3 text-xs text-neutral-500"><span className="h-px flex-1 bg-border" />ou<span className="h-px flex-1 bg-border" /></div>
        <Button variant="outline" className="w-full" size="lg" onClick={googleLogin} disabled={busy}><span aria-hidden="true" className="font-bold">G</span>Entrar com o Google</Button>
      </>}
      <p className="mt-6 text-center text-sm text-neutral-600">{mode === 'login' ? 'Ainda não tem conta?' : 'Já tem conta?'}{' '}<button type="button" className="font-semibold text-primary-700 underline underline-offset-2" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>{mode === 'login' ? 'Criar conta' : 'Fazer login'}</button></p>
      <ButtonLink to="/" variant="ghost" className="mt-3 w-full justify-center">Voltar à página inicial</ButtonLink>
    </section>
  </main>;
}
