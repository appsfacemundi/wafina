'use client';

import type { GeoRegion } from '@wafina/shared';
import { useRouter } from 'next/navigation';
import { Button, Card } from '@wafina/ui';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { useAuth, useRequireSession } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';

export default function HomePage() {
  const session = useRequireSession();
  const { firebaseUser } = useAuth();
  const router = useRouter();
  const [activeCountryName, setActiveCountryName] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseUser || !session?.activeCountryId) return;
    (async () => {
      try {
        const idToken = await firebaseUser.getIdToken();
        const countries = await apiFetch<GeoRegion[]>('/geo-regions/all-countries', { idToken });
        setActiveCountryName(countries.find((c) => c.Region_ID === session.activeCountryId)?.Name ?? null);
      } catch {
        // Non-critical — the banner just doesn't render if this fails.
      }
    })();
  }, [firebaseUser, session?.activeCountryId]);

  if (!session) return null;

  return (
    <AppShell>
      <div className="stack">
        <h1 style={{ fontSize: 24 }}>Bem-vindo(a)</h1>
        {activeCountryName && (
          <Card className="stack" style={{ gap: 2 }}>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              🌍 País ativo
            </p>
            <p style={{ fontSize: 18, fontWeight: 600 }}>{activeCountryName}</p>
          </Card>
        )}
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
