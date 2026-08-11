'use client';

import type { GeoRegion } from '@wafina/shared';
import { useEffect, useMemo, useState } from 'react';
import { Card, EmptyState, Photo } from '@wafina/ui';
import { AppShell } from '@/components/AppShell';
import { useAuth, useRequireSession } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';

/** Matches the public projection GET /institutions returns for donors — not the full Institution shape. */
interface PublicInstitution {
  Institution_ID: string;
  Name: string;
  Logo: string | null;
  Type: string;
  Needs_List: string | null;
  Total_Items_Received: number;
  Country_ID: string;
}

export default function InstitutionsPage() {
  const session = useRequireSession();
  const { firebaseUser } = useAuth();
  const [institutions, setInstitutions] = useState<PublicInstitution[] | null>(null);
  const [countries, setCountries] = useState<GeoRegion[]>([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!firebaseUser) return;
    (async () => {
      try {
        const idToken = await firebaseUser.getIdToken();
        const [institutionList, countryList] = await Promise.all([
          apiFetch<PublicInstitution[]>('/institutions', { idToken }),
          apiFetch<GeoRegion[]>('/geo-regions/all-countries', { idToken }),
        ]);
        setInstitutions(institutionList);
        setCountries(countryList);
      } catch {
        setError('Não foi possível carregar as instituições.');
      }
    })();
  }, [firebaseUser]);

  function countryName(countryId: string): string {
    return countries.find((c) => c.Region_ID === countryId)?.Name ?? '';
  }

  // UX fix, 2026-08-11 — parity with mobile-donor: alphabetical order + a
  // name/type search, previously raw API order with no way to find one.
  const visibleInstitutions = useMemo(() => {
    const sorted = [...(institutions ?? [])].sort((a, b) => a.Name.localeCompare(b.Name, 'pt'));
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (inst) => inst.Name.toLowerCase().includes(q) || inst.Type.toLowerCase().includes(q),
    );
  }, [institutions, search]);

  if (!session) return null;

  return (
    <AppShell>
      <div className="stack">
        <h1 style={{ fontSize: 24 }}>Instituições</h1>
        {error && <div className="banner banner-error">{error}</div>}
        {!error && institutions === null && (
          <p style={{ color: 'var(--color-text-muted)' }}>A carregar…</p>
        )}
        {institutions?.length === 0 && (
          <EmptyState
            title="Ainda sem instituições verificadas"
            description="As instituições aprovadas pelo Admin aparecem aqui."
            icon="building"
          />
        )}
        {institutions && institutions.length > 0 && (
          <input
            className="input"
            placeholder="Pesquisar por nome ou tipo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Pesquisar instituições"
          />
        )}
        {institutions && institutions.length > 0 && visibleInstitutions.length === 0 && (
          <EmptyState title="Sem resultados" description="Nenhuma instituição corresponde à pesquisa." />
        )}
        {institutions && institutions.length > 0 && (
          <div className="stack">
            {visibleInstitutions.map((inst) => (
              <Card key={inst.Institution_ID} className="institution-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Photo
                    src={inst.Logo}
                    style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }}
                  />
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 16 }}>{inst.Name}</p>
                    <p className="needs">
                      {inst.Type.trim()}
                      {countryName(inst.Country_ID) && ` · ${countryName(inst.Country_ID)}`}
                    </p>
                  </div>
                </div>
                {inst.Needs_List && <p className="needs">Necessita: {inst.Needs_List}</p>}
                <p className="mono" style={{ fontSize: 11.5, color: 'var(--color-text-faint)' }}>
                  {inst.Total_Items_Received} itens recebidos
                </p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
