'use client';

import type { GeoRegion } from '@wafina/shared';
import { Badge, Button, Card, Input, useToast } from '@wafina/ui';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { useAuth, useRequireAdminSession } from '@/context/AuthContext';
import { ApiError, apiFetch } from '@/lib/api';

export default function AdminCountriesPage() {
  const session = useRequireAdminSession();
  const { firebaseUser } = useAuth();
  const { showToast } = useToast();

  const [countries, setCountries] = useState<GeoRegion[] | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [isoCode, setIsoCode] = useState('');
  const [creating, setCreating] = useState(false);

  async function load() {
    if (!firebaseUser) return;
    try {
      const idToken = await firebaseUser.getIdToken();
      setCountries(await apiFetch<GeoRegion[]>('/admin/countries', { idToken }));
    } catch {
      setError('Não foi possível carregar os países.');
    }
  }

  useEffect(() => {
    load();
  }, [firebaseUser]);

  async function onToggleActive(regionId: string, active: boolean) {
    setError('');
    setBusyId(regionId);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch(`/admin/countries/${regionId}`, { method: 'PATCH', idToken, body: { active } });
      await load();
      showToast(active ? 'País ativado.' : 'País desativado.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível atualizar o país.');
    } finally {
      setBusyId(null);
    }
  }

  async function onCreate() {
    if (!name.trim() || isoCode.trim().length !== 2) {
      setError('Indique o nome e o código ISO de 2 letras do país.');
      return;
    }
    setError('');
    setCreating(true);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch('/admin/countries', { method: 'POST', idToken, body: { name, isoCode } });
      setName('');
      setIsoCode('');
      await load();
      showToast('País adicionado como "Brevemente".');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível adicionar o país.');
    } finally {
      setCreating(false);
    }
  }

  if (!session) return null;

  return (
    <AppShell>
      <div className="stack">
        <h1 style={{ fontSize: 24 }}>Países</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13.5 }}>
          Ativar um país torna-o imediatamente disponível para registo, doações e mudança de país ativo.
        </p>
        {error && <div className="banner banner-error">{error}</div>}

        <Card className="stack">
          <p style={{ fontWeight: 700, fontSize: 15 }}>Adicionar país</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} />
            <Input
              label="Código ISO"
              hint="Ex: PT, AO"
              value={isoCode}
              onChange={(e) => setIsoCode(e.target.value.toUpperCase())}
            />
            <Button onClick={onCreate} disabled={creating}>
              {creating ? 'A adicionar…' : 'Adicionar'}
            </Button>
          </div>
        </Card>

        {countries === null && !error && <p style={{ color: 'var(--color-text-muted)' }}>A carregar…</p>}
        {countries && (
          <div className="stack">
            {countries.map((c) => (
              <Card key={c.Region_ID} className="stack" style={{ gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 15 }}>{c.Name}</p>
                    <p className="mono" style={{ fontSize: 12, color: 'var(--color-text-faint)' }}>
                      {c.ISO_Code}
                    </p>
                  </div>
                  <Badge tone={c.Active ? 'success' : 'neutral'}>{c.Active ? 'Ativo' : 'Brevemente'}</Badge>
                </div>
                <div>
                  {c.Active ? (
                    <Button
                      variant="danger"
                      onClick={() => onToggleActive(c.Region_ID, false)}
                      disabled={busyId === c.Region_ID}
                    >
                      Desativar
                    </Button>
                  ) : (
                    <Button onClick={() => onToggleActive(c.Region_ID, true)} disabled={busyId === c.Region_ID}>
                      Ativar
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
