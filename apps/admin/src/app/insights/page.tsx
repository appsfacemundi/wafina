'use client';

import { DONATION_STATUS_LABEL, type AdminInsights } from '@wafina/shared';
import { Card, Icon, Select, type IconName } from '@wafina/ui';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AppShell } from '@/components/AppShell';
import { useAuth, useRequireAdminSession } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';

const InsightsMap = dynamic(() => import('@/components/InsightsMap').then((m) => m.InsightsMap), {
  ssr: false,
  loading: () => (
    <div style={{ height: 480, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
      A carregar mapa…
    </div>
  ),
});

const STATUS_COLORS: Record<string, string> = {
  Pending: '#d97706',
  Claimed: '#64748b',
  Collection_Scheduled: '#0057d9',
  Collected: '#0046ad',
  Delivered: '#22c55e',
};

const MAP_KIND_OPTIONS = [
  { value: 'both', label: 'Doações e Instituições' },
  { value: 'donation', label: 'Só Doações' },
  { value: 'institution', label: 'Só Instituições' },
] as const;

function Kpi({ icon, value, label }: { icon: IconName; value: number | undefined; label: string }) {
  return (
    <Card className="stack">
      <span className="stat-icon">
        <Icon name={icon} size={17} />
      </span>
      <p style={{ fontSize: 26, fontWeight: 700 }}>{value !== undefined ? value.toLocaleString('pt-PT') : '—'}</p>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 12.5 }}>{label}</p>
    </Card>
  );
}

/**
 * Admin Insights module, 2026-08-08 (stakeholder-requested, launch-critical)
 * — the geographic/statistical dashboard for presenting Wafina's reach to
 * institutions and partners: a map plotting every geo-pointed donation and
 * institution, plus per-country and time-series breakdowns. One aggregated
 * endpoint (getAdminInsights) backs the whole page; filtering below is
 * client-side over that single payload.
 */
export default function AdminInsightsPage() {
  const session = useRequireAdminSession();
  const { firebaseUser } = useAuth();
  const [insights, setInsights] = useState<AdminInsights | null>(null);
  const [error, setError] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [mapKind, setMapKind] = useState<(typeof MAP_KIND_OPTIONS)[number]['value']>('both');

  useEffect(() => {
    if (!firebaseUser) return;
    (async () => {
      try {
        const idToken = await firebaseUser.getIdToken();
        setInsights(await apiFetch<AdminInsights>('/admin/insights', { idToken }));
      } catch {
        setError('Não foi possível carregar os dados.');
      }
    })();
  }, [firebaseUser]);

  const filteredPoints = useMemo(() => {
    if (!insights) return [];
    return insights.mapPoints.filter(
      (p) => (mapKind === 'both' || p.kind === mapKind) && (!countryFilter || p.Country_ID === countryFilter),
    );
  }, [insights, countryFilter, mapKind]);


  const displayedKpis = useMemo(() => {
    if (!insights) return undefined;
    if (!countryFilter) return insights.kpis;
    const c = insights.byCountry.find((x) => x.Country_ID === countryFilter);
    if (!c) return insights.kpis;
    return {
      totalDonations: c.donations,
      totalItemsDonated: c.itemsDonated,
      totalInstitutions: c.institutions,
      verifiedInstitutions: c.institutionsVerified,
      totalDonors: c.donors,
      corporateAccounts: insights.kpis.corporateAccounts,
      totalDelivered: c.donationsDelivered,
      activeCountries: insights.kpis.activeCountries,
    };
  }, [insights, countryFilter]);

  const statusChartData = useMemo(
    () => insights?.statusBreakdown.filter((s) => s.count > 0).map((s) => ({ name: DONATION_STATUS_LABEL[s.status], value: s.count, status: s.status })) ?? [],
    [insights],
  );

  const donorTypeChartData = useMemo(
    () =>
      insights
        ? [
            { name: 'Individuais', value: insights.donorTypeBreakdown.individual },
            { name: 'Empresariais', value: insights.donorTypeBreakdown.corporate },
          ].filter((d) => d.value > 0)
        : [],
    [insights],
  );

  if (!session) return null;

  return (
    <AppShell>
      <div className="stack">
        <h1 style={{ fontSize: 24 }}>Painel Geográfico</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13.5 }}>
          Visão geral do alcance da Wafina — doações, instituições e doadores, no mapa e por país. Use os
          filtros abaixo para explorar por país.
        </p>

        {error && <div className="banner banner-error">{error}</div>}
        {!error && !insights && <p style={{ color: 'var(--color-text-muted)' }}>A carregar…</p>}

        {insights && (
          <>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Select label="Filtrar por país" value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}>
                <option value="">Todos os países</option>
                {insights.byCountry.map((c) => (
                  <option key={c.Country_ID} value={c.Country_ID}>
                    {c.Name}
                  </option>
                ))}
              </Select>
              <Select label="Mostrar no mapa" value={mapKind} onChange={(e) => setMapKind(e.target.value as typeof mapKind)}>
                {MAP_KIND_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="stats-grid">
              <Kpi icon="package" value={displayedKpis?.totalDonations} label="Total de doações" />
              <Kpi icon="check-circle" value={displayedKpis?.totalDelivered} label="Doações entregues" />
              <Kpi icon="truck" value={displayedKpis?.totalItemsDonated} label="Itens doados" />
              <Kpi icon="building" value={displayedKpis?.totalInstitutions} label="Instituições" />
              <Kpi icon="shield-check" value={displayedKpis?.verifiedInstitutions} label="Instituições verificadas" />
              <Kpi icon="users" value={displayedKpis?.totalDonors} label="Doadores" />
              <Kpi icon="briefcase" value={displayedKpis?.corporateAccounts} label="Contas empresariais" />
              <Kpi icon="globe" value={displayedKpis?.activeCountries} label="Países ativos" />
            </div>

            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ height: 480 }}>
                <InsightsMap points={filteredPoints} />
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: 12, fontSize: 12, color: 'var(--color-text-muted)' }}>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 999, background: '#d97706', marginRight: 4 }} />Pendente</span>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 999, background: '#0057d9', marginRight: 4 }} />Em curso</span>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 999, background: '#22c55e', marginRight: 4 }} />Entregue / Instituição verificada</span>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 999, background: '#64748b', marginRight: 4 }} />Aceite</span>
              </div>
            </Card>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
              <Card>
                <p style={{ fontWeight: 700, marginBottom: 8 }}>Doações por país</p>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={insights.byCountry}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="Name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="donations" name="Doações" fill="#0057d9" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card>
                <p style={{ fontWeight: 700, marginBottom: 8 }}>Doações por estado</p>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={statusChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                      {statusChartData.map((entry) => (
                        <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? '#64748b'} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>

              <Card>
                <p style={{ fontWeight: 700, marginBottom: 8 }}>Doadores: individuais vs. empresariais</p>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={donorTypeChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                      <Cell fill="#0057d9" />
                      <Cell fill="#ff5a36" />
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>

              <Card>
                <p style={{ fontWeight: 700, marginBottom: 8 }}>Doações submetidas (últimos 30 dias)</p>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={insights.donationsOverTime}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="donations" name="Doações" stroke="#0057d9" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </div>

            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <p style={{ fontWeight: 700, padding: '16px 16px 0' }}>Resumo por país</p>
              <div style={{ overflowX: 'auto', padding: 16 }}>
                <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: 'right', color: 'var(--color-text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left', position: 'sticky', left: 0, background: 'var(--color-surface)' }}>País</th>
                      <th style={{ padding: '8px 10px' }}>Doações</th>
                      <th style={{ padding: '8px 10px' }}>Itens</th>
                      <th style={{ padding: '8px 10px' }}>Pendentes</th>
                      <th style={{ padding: '8px 10px' }}>Em curso</th>
                      <th style={{ padding: '8px 10px' }}>Entregues</th>
                      <th style={{ padding: '8px 10px' }}>Instituições</th>
                      <th style={{ padding: '8px 10px' }}>Verificadas</th>
                      <th style={{ padding: '8px 10px' }}>Doadores</th>
                    </tr>
                  </thead>
                  <tbody>
                    {insights.byCountry.map((c, i) => (
                      <tr
                        key={c.Country_ID}
                        style={{
                          borderTop: '1px solid var(--color-border)',
                          background: i % 2 === 1 ? 'var(--color-surface-2, rgba(0,0,0,0.02))' : 'transparent',
                        }}
                      >
                        <td style={{ padding: '9px 10px', fontWeight: 600, position: 'sticky', left: 0, background: 'inherit' }}>
                          {c.Name}
                        </td>
                        <td style={{ padding: '9px 10px', textAlign: 'right' }}>{c.donations.toLocaleString('pt-PT')}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right' }}>{c.itemsDonated.toLocaleString('pt-PT')}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right' }}>{c.donationsPending.toLocaleString('pt-PT')}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right' }}>{c.donationsClaimed.toLocaleString('pt-PT')}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right' }}>{c.donationsDelivered.toLocaleString('pt-PT')}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right' }}>{c.institutions.toLocaleString('pt-PT')}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right' }}>{c.institutionsVerified.toLocaleString('pt-PT')}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right' }}>{c.donors.toLocaleString('pt-PT')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
