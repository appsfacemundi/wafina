'use client';

import { Button, Card } from '@wafina/ui';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useOwnInstitution } from '@/hooks/useOwnInstitution';

export default function WelcomePage() {
  const { session, loading: authLoading } = useAuth();
  const { institution, loading: institutionLoading } = useOwnInstitution();
  const router = useRouter();

  useEffect(() => {
    if (authLoading || !session || institutionLoading) return;
    if (!institution) router.replace('/register');
    else if (!institution.Verified) router.replace('/verification-status');
    else router.replace('/home');
  }, [session, authLoading, institution, institutionLoading, router]);

  if (authLoading || session) return null;

  return (
    <main className="screen-center">
      <div className="stack" style={{ textAlign: 'center', maxWidth: 360 }}>
        <h1 style={{ fontSize: 32 }}>Wafina Instituição</h1>
        <p style={{ color: 'var(--color-text-muted)' }}>
          Receba doações de quem quer ajudar a sua comunidade.
        </p>
      </div>
      <Card className="auth-card stack">
        <Button fullWidth onClick={() => router.push('/sign-in')}>
          Entrar
        </Button>
        <Button variant="secondary" fullWidth onClick={() => router.push('/sign-up')}>
          Registar instituição
        </Button>
      </Card>
    </main>
  );
}
