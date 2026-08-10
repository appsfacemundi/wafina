'use client';

import type { GeoRegion } from '@wafina/shared';
import { ANIMAL_SHELTER_TYPES, detectSupportedCountryFromCoords, INSTITUTION_TYPES } from '@wafina/shared';
import { Button, Card, Input, Photo, Select } from '@wafina/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useAuth, useRequireSession } from '@/context/AuthContext';
import { apiFetch, ApiError } from '@/lib/api';

type LocationStatus = 'capturing' | 'captured' | 'failed' | 'geocoding' | 'geocoded';

export default function RegisterInstitutionPage() {
  const session = useRequireSession();
  const { firebaseUser } = useAuth();
  const router = useRouter();
  const isShelter = session?.role === 'Animal_Shelter';
  const typeOptions = isShelter ? ANIMAL_SHELTER_TYPES : INSTITUTION_TYPES;

  const [name, setName] = useState('');
  // Registration UX fix, 2026-08-10 — prefilled dropdown (never blank) instead
  // of free text; 'Outro' reveals customType below for anything not listed.
  const [type, setType] = useState<string>(INSTITUTION_TYPES[0]);
  const [customType, setCustomType] = useState('');
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [needsList, setNeedsList] = useState('');
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('capturing');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [address, setAddress] = useState('');
  const [locationError, setLocationError] = useState('');

  const [countries, setCountries] = useState<GeoRegion[] | null>(null);
  const [countryId, setCountryId] = useState('');
  const [coverageArea, setCoverageArea] = useState('');

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function onPickLogo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLogo(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  // Re-defaults the dropdown when the account kind resolves to Animal_Shelter
  // (session loads after the Institution-list default above is already set),
  // but only if the user hasn't already picked something from that new list.
  useEffect(() => {
    if (!(typeOptions as readonly string[]).includes(type)) {
      setType(typeOptions[0]);
      setCustomType('');
    }
  }, [isShelter]);

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
    if (type === 'Outro' && !customType.trim()) {
      setError('Descreva o tipo no campo "Outro".');
      return;
    }
    if (!logo) {
      setError(isShelter ? 'Adicione o logótipo do abrigo.' : 'Adicione o logótipo da instituição.');
      return;
    }
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
      const form = new FormData();
      form.append('Name', name);
      form.append('Type', type === 'Outro' ? customType.trim() : type);
      form.append('Location_lat', lat);
      form.append('Location_lng', lng);
      if (needsList) form.append('Needs_List', needsList);
      form.append('Country_ID', countryId);
      if (coverageArea) form.append('Coverage_Area', coverageArea);
      if (address.trim()) form.append('Address', address.trim());
      form.append('logo', logo);
      await apiFetch('/institutions', { method: 'POST', idToken, body: form });
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
        <h1 style={{ fontSize: 22 }}>{isShelter ? 'Registar abrigo de animais' : 'Registar instituição'}</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13.5 }}>
          {isShelter
            ? 'Após o envio, o seu abrigo fica pendente de verificação pelo Admin.'
            : 'Após o envio, a sua instituição fica pendente de verificação pelo Admin.'}
        </p>
        <form onSubmit={onSubmit} className="stack">
          <Input
            label={isShelter ? 'Nome do abrigo' : 'Nome da instituição'}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Select label="Tipo" required value={type} onChange={(e) => setType(e.target.value)}>
            {typeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
          {type === 'Outro' && (
            <Input
              label="Descreva o tipo"
              required
              value={customType}
              onChange={(e) => setCustomType(e.target.value)}
            />
          )}

          <div className="field">
            <label>{isShelter ? 'Logótipo do abrigo (obrigatório)' : 'Logótipo da instituição (obrigatório)'}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Photo
                src={logoPreview}
                style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover' }}
              />
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={onPickLogo}
              />
              <Button
                variant="secondary"
                type="button"
                onClick={() => logoInputRef.current?.click()}
              >
                {logo ? 'Escolher outro logótipo' : 'Escolher logótipo'}
              </Button>
            </div>
          </div>
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
