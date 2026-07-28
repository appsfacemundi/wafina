'use client';

import { useRouter } from 'next/navigation';
import { Button, Card, Input } from '@wafina/ui';
import { useState, type FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { friendlyAuthError } from '@/lib/auth-errors';

export default function SignUpPage() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signUp(email, password);
      router.replace('/');
    } catch (err) {
      setError(friendlyAuthError((err as { code?: string }).code ?? ''));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="screen-center">
      <Card className="auth-card stack">
        <h1 style={{ fontSize: 24 }}>Criar conta</h1>
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
            minLength={6}
            hint="Mínimo de 6 caracteres."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <div className="banner banner-error">{error}</div>}
          <Button type="submit" fullWidth disabled={submitting}>
            {submitting ? 'A criar conta…' : 'Criar conta'}
          </Button>
        </form>
        <Button variant="ghost" fullWidth onClick={() => router.push('/sign-in')}>
          Já tem conta? Entrar
        </Button>
      </Card>
    </main>
  );
}
