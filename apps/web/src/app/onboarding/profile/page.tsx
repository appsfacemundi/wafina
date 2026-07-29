'use client';

import type { GeoRegion } from '@wafina/shared';
import { useRouter } from 'next/navigation';
import { Button, Card, Input, Select } from '@wafina/ui';
import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, ApiError } from '@/lib/api';

export default function ProfilePage() {
  const { firebaseUser, refreshSession } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [countries, setCountries] = useState<GeoRegion[] | null>(null);
  const [homeCountryId, setHomeCountryId] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const idToken = await firebaseUser?.getIdToken();
        const list = await apiFetch<GeoRegion[]>('/geo-regions/countries', { idToken });
        setCountries(list);
        if (list[0]) setHomeCountryId(list[0].Region_ID);
      } catch {
        setError('Não foi possível carregar a lista de países.');
      }
    })();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch('/donor/profile', {
        method: 'PATCH',
        idToken,
        body: { Name: name, Phone: phone, Home_Country_ID: homeCountryId },
      });
      await refreshSession();
      router.replace('/home');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível guardar. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="screen-center">
      <Card className="auth-card stack">
        <h1 style={{ fontSize: 24 }}>Complete o seu perfil</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13.5 }}>
          Só mais um passo antes de poder doar.
        </p>
        <form onSubmit={onSubmit} className="stack">
          <Input label="Nome" required value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            label="Telefone"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Select
            label="País"
            required
            value={homeCountryId}
            onChange={(e) => setHomeCountryId(e.target.value)}
          >
            {countries?.map((c) => (
              <option key={c.Region_ID} value={c.Region_ID}>
                {c.Name}
              </option>
            ))}
          </Select>
          {error && <div className="banner banner-error">{error}</div>}
          <Button type="submit" fullWidth disabled={submitting || !homeCountryId}>
            {submitting ? 'A guardar…' : 'Continuar'}
          </Button>
        </form>
      </Card>
    </main>
  );
}
