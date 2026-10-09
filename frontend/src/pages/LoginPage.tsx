import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { Input } from '@/components/ui/Input';
import { API_BASE_URL } from '@/config/environment';
import { useAuthStore } from '@/stores/authStore';
import seplagLogo from '@/assets/logo-seplag-branco.png';

type Mode = 'login' | 'register' | 'verify' | 'forgot';
export function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const status = useAuthStore((state) => state.status);
  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);
  const verifyEmail = useAuthStore((state) => state.verifyEmail);
  const resendEmailVerification = useAuthStore((state) => state.resendEmailVerification);
  const requestPasswordReset = useAuthStore((state) => state.requestPasswordReset);
  const resetPassword = useAuthStore((state) => state.resetPassword);
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [resetRequested, setResetRequested] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const params = new URLSearchParams(location.search);
  const returnToParam = params.get('returnTo');
  const returnTo = returnToParam?.startsWith('/') && !returnToParam.startsWith('//') ? returnToParam : '/';

  useEffect(() => { void fetch(`${API_BASE_URL}/auth/providers`).then((response) => response.json()).then((data: { google?: boolean }) => setGoogleEnabled(data.google === true)).catch(() => setGoogleEnabled(false)); }, []);
  useEffect(() => { if (status === 'authenticated') navigate(returnTo, { replace: true }); }, [status, navigate, returnTo]);

  if (status === 'loading') return <main className="grid min-h-screen place-items-center text-neutral-600" role="status">Verificando sua sessão…</main>;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError('');
    setBusy(true);
    try {
      if (mode === 'register') {
        if (password !== confirmation) { setError('As senhas não coincidem.'); return; }
        const message = await register(email, password);
        setMode('verify'); setNotice(message);
      } else if (mode === 'verify') {
        await verifyEmail(email, verificationCode);
      } else if (mode === 'forgot' && !resetRequested) {
        const message = await requestPasswordReset(email);
        setResetRequested(true); setNotice(message);
      } else if (mode === 'forgot') {
        if (password !== confirmation) { setError('As senhas não coincidem.'); return; }
        await resetPassword(email, resetCode, password);
        setMode('login'); setResetRequested(false); setResetCode(''); setPassword(''); setConfirmation('');
        setNotice('Senha redefinida. Entre com sua nova senha.');
      } else {
        await login(email, password);
      }
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível concluir.'); }
    finally { setBusy(false); }
  };

  const googleLogin = () => {
    setBusy(true);
    window.location.assign(`${API_BASE_URL}/auth/google?returnTo=${encodeURIComponent(returnTo)}`);
  };

  return <main className="grid min-h-screen place-items-center bg-neutral-50 px-4 py-12">
    <section className="w-full max-w-md rounded-2xl border border-border bg-surface p-7 shadow-xl sm:p-9" aria-labelledby="auth-title">
      <div className="mb-7 flex justify-center"><ButtonLink to="/" variant="ghost" className="gap-2 font-display text-2xl font-extrabold tracking-tight text-primary-800"><img src={seplagLogo} alt="" className="size-10 shrink-0 object-contain" />QUIZ <span className="text-primary-500">SEPLAG</span></ButtonLink></div>
      <h1 id="auth-title" className="type-h2 text-center text-neutral-900">{mode === 'login' ? 'Fazer login' : mode === 'register' ? 'Criar conta' : mode === 'verify' ? 'Confirme seu e-mail' : 'Recuperar senha'}</h1>
      <p className="type-body mt-2 text-center text-neutral-600">{mode === 'login' ? 'Entre para criar e gerenciar seus quizzes.' : mode === 'register' ? 'Crie sua conta para começar a usar a plataforma.' : mode === 'verify' ? 'Digite o código de 6 dígitos enviado para seu e-mail.' : resetRequested ? 'Digite o código recebido e escolha uma nova senha.' : 'Informe o e-mail cadastrado para receber um código de verificação.'}</p>
      {params.get('error') === 'google_login_failed' && <p role="alert" className="mt-5 rounded-lg border border-danger-500/30 bg-danger-50 p-3 text-sm text-danger-700">Não foi possível entrar com o Google. Verifique as credenciais e tente novamente.</p>}
      {error && <p role="alert" className="mt-5 rounded-lg border border-danger-500/30 bg-danger-50 p-3 text-sm text-danger-700">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-lg border border-primary-500/30 bg-primary-50 p-3 text-sm text-primary-800">{notice}</p>}
      <form className="mt-6 flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
        <Input label="E-mail" type="email" autoComplete="email" required maxLength={191} value={email} onChange={(event) => setEmail(event.target.value)} readOnly={(mode === 'forgot' && resetRequested) || mode === 'verify'} />
        {mode === 'verify' && <Input label="Código de confirmação" type="text" inputMode="numeric" autoComplete="one-time-code" required minLength={6} maxLength={6} pattern="[0-9]{6}" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/gu, '').slice(0, 6))} helperText="O código expira em 10 minutos." />}
        {mode === 'forgot' && resetRequested && <Input label="Código de verificação" type="text" inputMode="numeric" autoComplete="one-time-code" required minLength={6} maxLength={6} pattern="[0-9]{6}" value={resetCode} onChange={(event) => setResetCode(event.target.value.replace(/\D/gu, '').slice(0, 6))} helperText="O código expira em 10 minutos." />}
        {mode !== 'verify' && (mode !== 'forgot' || resetRequested) ? <Input label={mode === 'forgot' ? 'Nova senha' : 'Senha'} type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required={mode !== 'forgot' || resetRequested} minLength={10} maxLength={128} helperText={mode !== 'login' ? 'Use pelo menos 10 caracteres.' : undefined} value={password} onChange={(event) => setPassword(event.target.value)} /> : null}
        {(mode === 'register' || (mode === 'forgot' && resetRequested)) && <Input label={mode === 'register' ? 'Repita a senha' : 'Repita a nova senha'} type="password" autoComplete="new-password" required minLength={10} maxLength={128} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />}
        <Button className="mt-1 w-full" type="submit" size="lg" disabled={busy}>{busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : mode === 'register' ? 'Criar conta' : mode === 'verify' ? 'Confirmar e entrar' : resetRequested ? 'Redefinir senha' : 'Enviar código'}</Button>
      </form>
      {mode === 'login' && <button type="button" className="mt-4 w-full text-center text-sm font-semibold text-primary-800 underline underline-offset-2" onClick={() => { setMode('forgot'); setError(''); setNotice(''); }}>Esqueci minha senha</button>}
      {(mode === 'login' || mode === 'verify') && <button type="button" className="mt-3 w-full text-center text-sm font-semibold text-primary-800 underline underline-offset-2 disabled:opacity-50" disabled={busy || !email} onClick={() => { setBusy(true); setError(''); void resendEmailVerification(email).then(setNotice).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Não foi possível enviar o código.')).finally(() => setBusy(false)); }}>Reenviar código de confirmação</button>}
      {mode !== 'forgot' && mode !== 'verify' && googleEnabled && <>
        <div className="my-5 flex items-center gap-3 text-xs text-neutral-500"><span className="h-px flex-1 bg-border" />ou<span className="h-px flex-1 bg-border" /></div>
        <Button variant="outline" className="w-full" size="lg" onClick={googleLogin} disabled={busy}><span aria-hidden="true" className="font-bold">G</span>Entrar com o Google</Button>
      </>}
      {mode !== 'verify' && <p className="mt-6 text-center text-sm text-neutral-600">{mode === 'login' ? 'Ainda não tem conta?' : mode === 'register' ? 'Já tem conta?' : 'Lembrou sua senha?'}{' '}<button type="button" className="font-semibold text-primary-800 underline underline-offset-2" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setNotice(''); setResetRequested(false); setPassword(''); setConfirmation(''); }}>{mode === 'login' ? 'Criar conta' : 'Fazer login'}</button></p>}
      {mode === 'verify' && <button type="button" className="mt-6 w-full text-center text-sm font-semibold text-primary-800 underline underline-offset-2" onClick={() => { setMode('login'); setError(''); setNotice(''); setVerificationCode(''); }}>Voltar para entrar</button>}
      <ButtonLink to="/" variant="ghost" className="mt-3 w-full justify-center">Voltar à página inicial</ButtonLink>
    </section>
  </main>;
}
