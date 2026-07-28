'use client';

import { useRouter } from 'next/navigation';
import { Button, Card } from '@wafina/ui';
import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function WelcomePage() {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || !session) return;
    router.replace(session.profileComplete ? '/home' : '/onboarding/profile');
  }, [session, loading, router]);

  if (loading || session) return null;

  return (
    <main className="screen-center">
      <div className="stack" style={{ textAlign: 'center', maxWidth: 360 }}>
        <h1 style={{ fontSize: 32 }}>Wafina</h1>
        <p style={{ color: 'var(--color-text-muted)' }}>Cada doação encontra um lar.</p>
      </div>
      <Card className="auth-card stack">
        <Button fullWidth onClick={() => router.push('/sign-in')}>
          Entrar
        </Button>
        <Button variant="secondary" fullWidth onClick={() => router.push('/sign-up')}>
          Criar conta
        </Button>
      </Card>
    </main>
  );
}
