'use client';

import { Button, Card, Input } from '@wafina/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useAuth, useRequireSession } from '@/context/AuthContext';
import { apiFetch, ApiError } from '@/lib/api';

type LocationStatus = 'capturing' | 'captured' | 'failed';

export default function RegisterInstitutionPage() {
  const session = useRequireSession();
  const { firebaseUser } = useAuth();
  const router = useRouter();

  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [needsList, setNeedsList] = useState('');
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('capturing');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus('failed');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(String(position.coords.latitude));
        setLng(String(position.coords.longitude));
        setLocationStatus('captured');
      },
      () => setLocationStatus('failed'),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }, []);

  const hasValidLocation =
    lat !== '' && lng !== '' && !(Number(lat) === 0 && Number(lng) === 0) && !Number.isNaN(Number(lat));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!hasValidLocation) {
      setError('É necessária uma localização válida. Ative o GPS ou introduza as coordenadas.');
      return;
    }
    setSubmitting(true);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch('/institutions', {
        method: 'POST',
        idToken,
        body: {
          Name: name,
          Type: type,
          Location: { lat: Number(lat), lng: Number(lng) },
          Needs_List: needsList || undefined,
        },
      });
      router.push('/verification-status');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível submeter o registo.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!session) return null;

  return (
    <main className="screen-center">
      <Card className="auth-card stack" style={{ maxWidth: 420 }}>
        <h1 style={{ fontSize: 22 }}>Registar instituição</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13.5 }}>
          Após o envio, a sua instituição fica pendente de verificação pelo Admin.
        </p>
        <form onSubmit={onSubmit} className="stack">
          <Input
            label="Nome da instituição"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="Tipo"
            required
            hint="Ex: ONG, orfanato, igreja, escola, centro comunitário"
            value={type}
            onChange={(e) => setType(e.target.value)}
          />
          <Input
            label="Necessidades (opcional)"
            hint="Ex: Roupas, Alimentos"
            value={needsList}
            onChange={(e) => setNeedsList(e.target.value)}
          />

          <div className="field">
            <label>Localização</label>
            {locationStatus === 'capturing' && (
              <span className="hint">A obter a sua localização…</span>
            )}
            {locationStatus === 'captured' && (
              <span className="hint">
                Localização obtida: {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}
              </span>
            )}
            {locationStatus === 'failed' && (
              <div className="stack" style={{ gap: 8 }}>
                <span className="hint">
                  Não foi possível obter a localização automaticamente. Introduza-a manualmente.
                </span>
                <Input
                  label="Latitude"
                  type="number"
                  step="any"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                />
                <Input
                  label="Longitude"
                  type="number"
                  step="any"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                />
              </div>
            )}
          </div>

          {error && <div className="banner banner-error">{error}</div>}
          <Button type="submit" fullWidth disabled={submitting}>
            {submitting ? 'A submeter…' : 'Submeter registo'}
          </Button>
        </form>
      </Card>
    </main>
  );
}
