import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore, AuthRequestError } from '@/stores/authStore';

type Mode = 'login' | 'register';

export function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const status = useAuthStore((state) => state.status);
  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);
  const resendVerification = useAuthStore((state) => state.resendVerification);
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [verificationUrl, setVerificationUrl] = useState('');
  const [canResend, setCanResend] = useState(false);

  const params = new URLSearchParams(location.search);
  const requestedReturnTo = params.get('returnTo');
  const returnTo = requestedReturnTo?.startsWith('/') && !requestedReturnTo.startsWith('//') ? requestedReturnTo : '/library';

  useEffect(() => { if (status === 'authenticated') navigate(returnTo, { replace: true }); }, [status, navigate, returnTo]);
  if (status === 'authenticated') return null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(''); setMessage(''); setVerificationUrl(''); setCanResend(false);
    if (mode === 'register' && password !== passwordConfirmation) { setError('As senhas não coincidem.'); return; }
    setBusy(true);
    try {
      if (mode === 'login') await login(email, password);
      else {
        const result = await register(email, password);
        setMessage(result.verificationUrl ? 'Conta criada. Confirme seu endereço usando o link local de teste abaixo.' : 'Conta criada. Enviamos um link de confirmação para sua caixa de entrada.');
        setVerificationUrl(result.verificationUrl ?? '');
        setCanResend(true);
        setPassword(''); setPasswordConfirmation('');
      }
    } catch (cause) {
      if (cause instanceof AuthRequestError && cause.code === 'EMAIL_NOT_VERIFIED') setCanResend(true);
      setError(cause instanceof Error ? cause.message : 'Tente novamente.');
    } finally { setBusy(false); }
  };

  const resend = async () => {
    setBusy(true); setError(''); setMessage(''); setVerificationUrl('');
    try {
      const result = await resendVerification(email);
      setMessage('Se houver uma conta pendente para esse endereço, enviaremos outro link de confirmação.');
      setVerificationUrl(result.verificationUrl ?? '');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Tente novamente.'); }
    finally { setBusy(false); }
  };

  const switchMode = (next: Mode) => { setMode(next); setError(''); setMessage(''); setVerificationUrl(''); setCanResend(false); };

  return <main className="grid min-h-screen place-items-center bg-neutral-50 px-4 py-12">
    <section className="w-full max-w-md rounded-2xl border border-border bg-white p-8 shadow-lg sm:p-10" aria-labelledby="login-title">
      <div className="mb-8 text-center"><Link to="/" className="font-display text-2xl font-extrabold tracking-tight text-primary-700">QUIZ <span className="text-primary-500">SEPLAG</span></Link></div>
      <h1 id="login-title" className="type-h2 text-center text-neutral-900">{mode === 'login' ? 'Entre na sua conta' : 'Crie sua conta'}</h1>
      <p className="type-body mt-3 text-center text-neutral-600">{mode === 'login' ? 'Entre para criar quizzes e conduzir partidas.' : 'Confirme seu e-mail para começar a usar a plataforma.'}</p>
      {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {message && <div role="status" className="mt-5 rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}{verificationUrl && <p className="mt-3"><a className="font-medium underline" href={verificationUrl}>Abrir link de confirmação (ambiente local)</a></p>}</div>}
      <form className="mt-6 flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
        <Input label="E-mail" type="email" autoComplete="email" required maxLength={191} value={email} onChange={(event) => setEmail(event.target.value)} />
        <Input label="Senha" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={10} maxLength={128} helperText={mode === 'register' ? 'Use entre 10 e 128 caracteres.' : undefined} value={password} onChange={(event) => setPassword(event.target.value)} />
        {mode === 'register' && <Input label="Confirme a senha" type="password" autoComplete="new-password" required minLength={10} maxLength={128} value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} />}
        <Button className="mt-2 w-full" type="submit" size="lg" disabled={busy}>{busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}</Button>
      </form>
      {canResend && <Button className="mt-3 w-full" variant="outline" onClick={() => void resend()} disabled={busy}>Reenviar confirmação de e-mail</Button>}
      <p className="mt-6 text-center text-sm text-neutral-600">{mode === 'login' ? 'Ainda não tem conta?' : 'Já tem uma conta?'}{' '}<button type="button" className="font-semibold text-primary-700 underline underline-offset-2" onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Cadastre-se' : 'Entrar'}</button></p>
    </section>
  </main>;
}
