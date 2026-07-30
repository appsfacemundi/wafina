'use client';

import { CONDITIONS, ITEM_TYPES } from '@wafina/shared';
import { Button, Card, Input, Select } from '@wafina/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AppShell } from '@/components/AppShell';
import { useAuth, useRequireSession } from '@/context/AuthContext';
import { apiFetch, ApiError } from '@/lib/api';

type LocationStatus = 'capturing' | 'captured' | 'failed';

export default function NewDonationPage() {
  const session = useRequireSession();
  const { firebaseUser } = useAuth();
  const router = useRouter();

  const [itemType, setItemType] = useState<string>(ITEM_TYPES[0]);
  const [quantity, setQuantity] = useState('');
  const [condition, setCondition] = useState<string>(CONDITIONS[0]);
  const [city, setCity] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [locationStatus, setLocationStatus] = useState<LocationStatus>('capturing');
  const [lat, setLat] = useState<string>('');
  const [lng, setLng] = useState<string>('');

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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!photo) {
      setError('Adicione uma fotografia da doação.');
      return;
    }
    if (!hasValidLocation) {
      setError('É necessária uma localização válida. Ative o GPS ou introduza as coordenadas.');
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
              {submitting ? 'A submeter…' : 'Confirmar doação'}
            </Button>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
