'use client';

import type { AdminDashboardStats, GeoRegion } from '@wafina/shared';
import { Card } from '@wafina/ui';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { useAuth, useRequireAdminSession } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';

/** Real-device finding, 2026-08-04: none of these tiles linked anywhere. */
function StatCard({
  href,
  value,
  label,
  breakdown,
}: {
  href: string;
  value: number | undefined;
  label: string;
  breakdown?: string;
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none', color: 'inherit' }}>
      <Card className="stack" style={{ cursor: 'pointer' }}>
        <p style={{ fontSize: 28, fontWeight: 700 }}>{value ?? '—'}</p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{label}</p>
        {breakdown && (
          <p style={{ color: 'var(--color-text-faint)', fontSize: 11.5 }}>{breakdown}</p>
        )}
      </Card>
    </Link>
  );
}

export default function AdminHomePage() {
  const session = useRequireAdminSession();
  const { firebaseUser } = useAuth();
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [countries, setCountries] = useState<GeoRegion[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!firebaseUser) return;
    (async () => {
      try {
        const idToken = await firebaseUser.getIdToken();
        const [statsResult, countryList] = await Promise.all([
          apiFetch<AdminDashboardStats>('/admin/stats', { idToken }),
          apiFetch<GeoRegion[]>('/geo-regions/all-countries', { idToken }),
        ]);
        setStats(statsResult);
        setCountries(countryList);
      } catch {
        setError('Não foi possível carregar as estatísticas.');
      }
    })();
  }, [firebaseUser]);

  if (!session) return null;

  const pendingByCountryLabel = stats
    ? Object.entries(stats.pendingDonationsByCountry)
        .map(([countryId, count]) => {
          const name = countries.find((c) => c.Region_ID === countryId)?.ISO_Code ?? countryId;
          return `${name}: ${count}`;
        })
        .join(' · ')
    : undefined;

  return (
    <AppShell>
      <div className="stack">
        <h1 style={{ fontSize: 24 }}>Bem-vindo(a)</h1>
        <Card className="stack">
          <p style={{ color: 'var(--color-text-muted)' }}>{session.email}</p>
        </Card>

        {error && <div className="banner banner-error">{error}</div>}

        <div className="stats-grid">
          <StatCard href="/institutions" value={stats?.pendingInstitutions} label="Instituições pendentes" />
          <StatCard href="/institutions" value={stats?.verifiedInstitutions} label="Instituições verificadas" />
          <StatCard
            href="/donations"
            value={stats?.pendingDonations}
            label="Doações pendentes"
            breakdown={pendingByCountryLabel}
          />
          <StatCard href="/donations" value={stats?.inFlightDonations} label="Doações em curso" />
          <StatCard href="/success-stories" value={stats?.pendingSuccessStories} label="Histórias por rever" />
          <StatCard href="/change-requests" value={stats?.pendingChangeRequests} label="Pedidos de alteração por rever" />
          <StatCard href="/disputes" value={stats?.openDisputes} label="Ocorrências abertas" />
        </div>
      </div>
    </AppShell>
  );
}
