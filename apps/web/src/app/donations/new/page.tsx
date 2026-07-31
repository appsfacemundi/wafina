'use client';

import { CONDITIONS, ITEM_TYPES } from '@wafina/shared';
import { Button, Card, Input, Select, useToast } from '@wafina/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AppShell } from '@/components/AppShell';
import { useAuth, useRequireSession } from '@/context/AuthContext';
import { apiFetch, ApiError } from '@/lib/api';

type LocationStatus = 'capturing' | 'captured' | 'failed' | 'geocoding' | 'geocoded';

export default function NewDonationPage() {
  const session = useRequireSession();
  const { firebaseUser } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();

  const [itemType, setItemType] = useState<string>(ITEM_TYPES[0]);
  const [quantity, setQuantity] = useState('');
  const [condition, setCondition] = useState<string>(CONDITIONS[0]);
  const [city, setCity] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [locationStatus, setLocationStatus] = useState<LocationStatus>('capturing');
  const [lat, setLat] = useState<string>('');
  const [lng, setLng] = useState<string>('');
  const [address, setAddress] = useState('');
  const [locationError, setLocationError] = useState('');

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

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

  function onPhotoChange(file: File | null) {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    setPhoto(file);
    if (file) {
      const url = URL.createObjectURL(file);
      objectUrlRef.current = url;
      setPhotoPreview(url);
    } else {
      setPhotoPreview(null);
    }
  }

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

    if (!photo) {
      setError('Adicione uma fotografia da doação.');
      return;
    }
    if (!hasValidLocation) {
      setError('É necessária uma localização válida. Ative o GPS ou confirme a sua morada.');
      return;
    }

    setSubmitting(true);
    try {
      const idToken = await firebaseUser?.getIdToken();
      const form = new FormData();
      form.append('Item_Type', itemType);
      form.append('Quantity', quantity);
      form.append('Condition', condition);
      form.append('City', city);
      form.append('Location_lat', lat);
      form.append('Location_lng', lng);
      form.append('photo', photo);

      await apiFetch('/donations', { method: 'POST', idToken, body: form });
      showToast('Doação submetida com sucesso!');
      router.push('/donations');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível submeter a doação.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!session) return null;

  return (
    <AppShell>
      <div className="stack" style={{ maxWidth: 480 }}>
        <h1 style={{ fontSize: 24 }}>Doar</h1>
        <Card>
          <form onSubmit={onSubmit} className="stack">
            <Select label="Tipo de item" value={itemType} onChange={(e) => setItemType(e.target.value)}>
              {ITEM_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>

            <Input
              label="Quantidade"
              type="number"
              min={1}
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />

            <Select label="Estado" value={condition} onChange={(e) => setCondition(e.target.value)}>
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>

            <Input
              label="Cidade (opcional)"
              placeholder="Ex: Luanda"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />

            <div className="field">
              <label htmlFor="photo-input">Fotografia da doação</label>
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Pré-visualização da doação"
                  style={{ maxWidth: '100%', borderRadius: 'var(--radius-md)' }}
                />
              ) : (
                <div className="upload-well">Escolha uma fotografia</div>
              )}
              <input
                id="photo-input"
                type="file"
                accept="image/*"
                onChange={(e) => onPhotoChange(e.target.files?.[0] ?? null)}
              />
            </div>

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
              {submitting ? 'A submeter…' : 'Confirmar doação'}
            </Button>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
