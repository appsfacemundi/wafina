'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button, Card, Input } from '@wafina/ui';
import { useAuth } from '@/context/AuthContext';
import { friendlyAuthError } from '@/lib/auth-errors';
import { ApiError } from '@/lib/api';

export default function SignInPage() {
  const { signIn, sessionError } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const displayedError = error || sessionError;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signIn(email, password);
      router.replace('/');
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
      <Card className="auth-card stack">
        <h1 style={{ fontSize: 24 }}>Entrar</h1>
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
        <Button variant="ghost" fullWidth onClick={() => router.push('/sign-up')}>
          Ainda não tem conta? Registar instituição
        </Button>
      </Card>
    </main>
  );
}
