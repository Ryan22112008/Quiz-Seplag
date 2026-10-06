import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { ButtonLink } from '@/components/ui/ButtonLink';

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const verifyEmail = useAuthStore((state) => state.verifyEmail);
  const started = useRef(false);
  const [message, setMessage] = useState('Confirmando seu endereço de e-mail…');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const token = params.get('token');
    if (started.current) return;
    started.current = true;
    if (!token) { setMessage('O link de confirmação está incompleto.'); setFailed(true); return; }
    void verifyEmail(token).then(() => {
      setMessage('E-mail confirmado. Sua conta está pronta.');
      navigate('/library', { replace: true });
    }).catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : 'O link é inválido ou expirou.');
      setFailed(true);
    });
  }, [params, navigate, verifyEmail]);

  return <main className="grid min-h-screen place-items-center bg-neutral-50 px-4 py-12"><section className="w-full max-w-lg rounded-2xl border border-border bg-white p-8 text-center shadow-lg">
    <h1 className="type-h2 text-neutral-900">Confirmação de e-mail</h1>
    <p className="type-body mt-4 text-neutral-600" role={failed ? 'alert' : 'status'}>{message}</p>
    {failed && <ButtonLink to="/login" className="mt-6">Voltar ao login</ButtonLink>}
    <p className="mt-6 text-sm text-neutral-500"><Link to="/" className="underline">Quiz SEPLAG</Link></p>
  </section></main>;
}
