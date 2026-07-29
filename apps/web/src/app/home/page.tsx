'use client';

import { useRouter } from 'next/navigation';
import { Button, Card } from '@wafina/ui';
import { AppShell } from '@/components/AppShell';
import { SwitchCountryPrompt } from '@/components/SwitchCountryPrompt';
import { useRequireSession } from '@/context/AuthContext';

export default function HomePage() {
  const session = useRequireSession();
  const router = useRouter();
  if (!session) return null;

  return (
    <AppShell>
      <SwitchCountryPrompt />
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
