'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { Button, Card, Input } from '@wafina/ui';
import { useAuth } from '@/context/AuthContext';
import { friendlyAuthError } from '@/lib/auth-errors';
import { ApiError } from '@/lib/api';

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const { signIn, sessionError } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(
    searchParams.get('error') === 'not-admin' ? 'Esta conta não tem acesso de administrador.' : '',
  );
  const [submitting, setSubmitting] = useState(false);
  const displayedError = error || sessionError;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signIn(email, password);
      router.replace('/home');
    } catch (err) {
      // ApiError means Firebase login succeeded but the backend rejected the
      // session (e.g. suspended account) — its message is already the right
      // one to show. Anything else is a Firebase auth error (wrong password,
      // unknown email, etc.), which needs the code-to-message mapping.
      setError(err instanceof ApiError ? err.message : friendlyAuthError((err as { code?: string }).code ?? ''));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="screen-center">
      <div className="stack" style={{ textAlign: 'center', maxWidth: 360 }}>
        <h1 style={{ fontSize: 28 }}>Wafina Admin</h1>
        <p style={{ color: 'var(--color-text-muted)' }}>Acesso reservado à administração.</p>
      </div>
      <Card className="auth-card stack">
        <form onSubmit={onSubmit} className="stack">
          <Input
            label="E-mail"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Palavra-passe"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {displayedError && <div className="banner banner-error">{displayedError}</div>}
          <Button type="submit" fullWidth disabled={submitting}>
            {submitting ? 'A entrar…' : 'Entrar'}
          </Button>
        </form>
      </Card>
    </main>
  );
}
