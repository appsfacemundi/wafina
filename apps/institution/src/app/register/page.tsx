'use client';

import type { GeoRegion } from '@wafina/shared';
import { detectSupportedCountryFromCoords } from '@wafina/shared';
import { Button, Card, Input, Select } from '@wafina/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useAuth, useRequireSession } from '@/context/AuthContext';
import { apiFetch, ApiError } from '@/lib/api';

type LocationStatus = 'capturing' | 'captured' | 'failed' | 'geocoding' | 'geocoded';

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
  const [address, setAddress] = useState('');
  const [locationError, setLocationError] = useState('');

  const [countries, setCountries] = useState<GeoRegion[] | null>(null);
  const [countryId, setCountryId] = useState('');
  const [serviceRadiusKm, setServiceRadiusKm] = useState('');
  const [coverageArea, setCoverageArea] = useState('');

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

  useEffect(() => {
    (async () => {
      try {
        const idToken = await firebaseUser?.getIdToken();
        const list = await apiFetch<GeoRegion[]>('/geo-regions/countries', { idToken });
        setCountries(list);
        if (list[0]) setCountryId(list[0].Region_ID);
      } catch {
        setError('Não foi possível carregar a lista de países.');
      }
    })();
  }, []);

  // Once GPS resolves, use it as a smart default for the country picker —
  // reusing the coordinates already captured for Location, no extra prompt.
  useEffect(() => {
    if ((locationStatus !== 'captured' && locationStatus !== 'geocoded') || !countries) return;
    const isoCode = detectSupportedCountryFromCoords(Number(lat), Number(lng));
    const match = countries.find((c) => c.ISO_Code === isoCode);
    if (match) setCountryId(match.Region_ID);
  }, [locationStatus, lat, lng, countries]);

  const hasValidLocation =
    lat !== '' && lng !== '' && !(Number(lat) === 0 && Number(lng) === 0) && !Number.isNaN(Number(lat));

  async function onFindAddress() {
    setLocationError('');
    if (!address.trim()) {
      setLocationError('Introduza uma morada.');
      return;
    }
    setLocationStatus('geocoding');
    try {
      const idToken = await firebaseUser?.getIdToken();
      const result = await apiFetch<{ lat: number; lng: number }>(
        `/geo-regions/geocode?address=${encodeURIComponent(address)}`,
        { idToken },
      );
      setLat(String(result.lat));
      setLng(String(result.lng));
      setLocationStatus('geocoded');
    } catch (err) {
      setLocationError(err instanceof ApiError ? err.message : 'Não foi possível localizar essa morada.');
      setLocationStatus('failed');
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!hasValidLocation) {
      setError('É necessária uma localização válida. Ative o GPS ou confirme a sua morada.');
      return;
    }
    if (!countryId) {
      setError('Selecione o país onde a instituição opera.');
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
          Country_ID: countryId,
          Service_Radius_Km: serviceRadiusKm ? Number(serviceRadiusKm) : undefined,
          Coverage_Area: coverageArea || undefined,
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
          {countries ? (
            <Select label="País" required value={countryId} onChange={(e) => setCountryId(e.target.value)}>
              {countries.map((c) => (
                <option key={c.Region_ID} value={c.Region_ID}>
                  {c.Name}
                </option>
              ))}
            </Select>
          ) : (
            <span className="hint">A carregar países…</span>
          )}
          <Input
            label="Necessidades (opcional)"
            hint="Ex: Roupas, Alimentos"
            value={needsList}
            onChange={(e) => setNeedsList(e.target.value)}
          />
          <Input
            label="Raio de cobertura em km (opcional)"
            hint="Ajuda a associar doadores próximos no futuro"
            type="number"
            value={serviceRadiusKm}
            onChange={(e) => setServiceRadiusKm(e.target.value)}
          />
          <Input
            label="Área de cobertura (opcional)"
            hint="Ex: toda a província de Luanda"
            value={coverageArea}
            onChange={(e) => setCoverageArea(e.target.value)}
          />

          <div className="field">
            <label>Localização</label>
            {locationStatus === 'capturing' && (
              <span className="hint">A obter a sua localização…</span>
            )}
            {(locationStatus === 'captured' || locationStatus === 'geocoded') && (
              <span className="hint">📍 Localização confirmada</span>
            )}
            {(locationStatus === 'failed' || locationStatus === 'geocoding') && (
              <div className="stack" style={{ gap: 8 }}>
                <span className="hint">
                  Não foi possível obter a sua localização automaticamente. Introduza a sua morada.
                </span>
                <Input
                  label="Morada"
                  placeholder="Ex: Rua Amílcar Cabral, Luanda"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onFindAddress}
                  disabled={locationStatus === 'geocoding'}
                >
                  {locationStatus === 'geocoding' ? 'A localizar…' : 'Confirmar morada'}
                </Button>
                {locationError && <div className="banner banner-error">{locationError}</div>}
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
