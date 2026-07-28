'use client';

import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useRequireSession } from '@/context/AuthContext';

export default function HomePage() {
  const session = useRequireSession();
  const router = useRouter();
  if (!session) return null;

  return (
    <AppShell>
      <div className="stack">
        <h1 style={{ fontSize: 24 }}>Bem-vindo(a)</h1>
        <Card className="stack">
          <p style={{ color: 'var(--color-text-muted)' }}>{session.email}</p>
          <p className="mono" style={{ fontSize: 12, color: 'var(--color-text-faint)' }}>
            ID: {session.userId}
          </p>
          <Button onClick={() => router.push('/donations/new')}>Doar agora</Button>
        </Card>
      </div>
    </AppShell>
  );
}
