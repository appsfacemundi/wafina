'use client';

import {
  CONDITIONS,
  DELIVERY_METHOD_LABEL,
  DELIVERY_METHODS,
  ITEM_TYPES,
  RECIPIENT_CATEGORIES,
  RECIPIENT_CATEGORY_LABEL,
  type CorporateAccount,
  type DeliveryMethod,
  type RecipientCategory,
} from '@wafina/shared';
import { Button, Card, Input, Select, useToast } from '@wafina/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AppShell } from '@/components/AppShell';
import { useAuth, useRequireSession } from '@/context/AuthContext';
import { apiFetch, ApiError } from '@/lib/api';

type LocationStatus = 'capturing' | 'captured' | 'failed' | 'geocoding' | 'geocoded';

/** Donate form redesign, 2026-08-07 — a label like "👨‍👩‍👧 Pessoas" splits into an emoji "icon" and its text. */
function splitEmojiLabel(label: string): { emoji: string; text: string } {
  const spaceIndex = label.indexOf(' ');
  if (spaceIndex === -1) return { emoji: '', text: label };
  return { emoji: label.slice(0, spaceIndex), text: label.slice(spaceIndex + 1) };
}

const CONDITION_EMOJI: Record<string, string> = {
  Novo: '✨',
  Usado: '🕰️',
  'Bom estado': '✅',
};

function SectionHeader({ n, title }: { n: number; title: string }) {
  return (
    <div className="section-header">
      <span className="section-badge">{n}</span>
      <span className="section-title">{title}</span>
    </div>
  );
}

function Chip({
  emoji,
  text,
  selected,
  onClick,
  wide,
}: {
  emoji: string;
  text: string;
  selected: boolean;
  onClick: () => void;
  wide?: boolean;
}) {
  return (
    <button type="button" className={['chip', wide ? 'wide' : '', selected ? 'selected' : ''].join(' ')} onClick={onClick}>
      <span className="chip-emoji">{emoji}</span>
      <span>{text}</span>
    </button>
  );
}

export default function NewDonationPage() {
  const session = useRequireSession();
  const { firebaseUser } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();

  const [itemType, setItemType] = useState<string>(ITEM_TYPES[0]);
  // Donate form redesign, 2026-08-07 — a blank starting quantity read as an
  // incomplete/broken stepper; starting at 1 matches the stepper control and
  // needs one less tap for the overwhelmingly common single-item donation.
  const [quantity, setQuantity] = useState('1');
  const [condition, setCondition] = useState<string>(CONDITIONS[0]);
  const [recipientCategory, setRecipientCategory] = useState<RecipientCategory>(RECIPIENT_CATEGORIES[0]);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>(DELIVERY_METHODS[0]);
  const [city, setCity] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [locationStatus, setLocationStatus] = useState<LocationStatus>('capturing');
  const [lat, setLat] = useState<string>('');
  const [lng, setLng] = useState<string>('');
  const [address, setAddress] = useState('');
  const [locationError, setLocationError] = useState('');
  // RC1 pickup-location fix, 2026-08-07 — collapsed by default when GPS
  // succeeds (keeps the form fast to fill), forced open when GPS failed
  // since an address is then the only way to get a valid location.
  const [addressExpanded, setAddressExpanded] = useState(false);

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  const [corporateAccount, setCorporateAccount] = useState<CorporateAccount | null>(null);
  const [isCorporateDonation, setIsCorporateDonation] = useState(false);

  useEffect(() => {
    if (!firebaseUser || !session?.corporateAccountId) return;
    (async () => {
      try {
        const idToken = await firebaseUser.getIdToken();
        setCorporateAccount(await apiFetch<CorporateAccount | null>('/donor/corporate-account', { idToken }));
      } catch {
        // Non-critical — the form just falls back to personal-only if this fails.
      }
    })();
  }, [firebaseUser, session?.corporateAccountId]);

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

  const quantityNumber = Number(quantity) || 0;
  function adjustQuantity(delta: number) {
    setQuantity(String(Math.max(1, quantityNumber + delta)));
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
      form.append('Recipient_Category', recipientCategory);
      form.append('Delivery_Method', deliveryMethod);
      form.append('City', city);
      form.append('Address', address);
      form.append('Location_lat', lat);
      form.append('Location_lng', lng);
      form.append('photo', photo);
      if (corporateAccount) {
        form.append('isCorporateDonation', String(isCorporateDonation));
      }

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

  const recipientChips = RECIPIENT_CATEGORIES.map((c) => ({ value: c, ...splitEmojiLabel(RECIPIENT_CATEGORY_LABEL[c]) }));
  const deliveryChips = DELIVERY_METHODS.map((m) => ({ value: m, ...splitEmojiLabel(DELIVERY_METHOD_LABEL[m]) }));
  let sectionN = 0;

  return (
    <AppShell>
      <div className="stack" style={{ maxWidth: 480 }}>
        <h1 style={{ fontSize: 24 }}>Doar</h1>

        <div style={{ textAlign: 'center', padding: '0 var(--space-4) var(--space-2)' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 'var(--radius-full)',
              background: 'var(--color-cta-soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 26,
              margin: '0 auto var(--space-2)',
            }}
          >
            🎁
          </div>
          <p style={{ fontWeight: 700, fontSize: 19 }}>A sua doação transforma vidas</p>
          <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)' }}>
            Preencha os dados abaixo para conectarmos a sua doação a quem mais precisa.
          </p>
        </div>

        <Card>
          <form onSubmit={onSubmit} className="stack">
            <div>
              <SectionHeader n={(sectionN += 1)} title="Tipo de item" />
              <Select label="Tipo de item" hideLabel value={itemType} onChange={(e) => setItemType(e.target.value)}>
                {ITEM_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <SectionHeader n={(sectionN += 1)} title="Quantidade" />
              <div className="stepper-row">
                <button type="button" className="stepper-btn" onClick={() => adjustQuantity(-1)} aria-label="Diminuir quantidade">
                  −
                </button>
                {/* Real-device feedback, 2026-08-07 — stepper-only forced a click-and-hold for larger quantities; typing the number directly is faster. */}
                <span className="stepper-value" style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
                  <input
                    className="stepper-input"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value.replace(/[^0-9]/g, ''))}
                    onBlur={() => setQuantity(String(Math.max(1, Number(quantity) || 1)))}
                    inputMode="numeric"
                    aria-label="Quantidade"
                  />
                  <span>{quantityNumber === 1 ? 'peça' : 'peças'}</span>
                </span>
                <button type="button" className="stepper-btn" onClick={() => adjustQuantity(1)} aria-label="Aumentar quantidade">
                  +
                </button>
              </div>
            </div>

            <div>
              <SectionHeader n={(sectionN += 1)} title="Estado do item" />
              <div className="chip-row">
                {CONDITIONS.map((c) => (
                  <Chip
                    key={c}
                    emoji={CONDITION_EMOJI[c] ?? '•'}
                    text={c}
                    selected={condition === c}
                    onClick={() => setCondition(c)}
                  />
                ))}
              </div>
            </div>

            <div>
              <SectionHeader n={(sectionN += 1)} title="Destinatário" />
              <div className="chip-row">
                {recipientChips.map((c) => (
                  <Chip
                    key={c.value}
                    emoji={c.emoji}
                    text={c.text}
                    selected={recipientCategory === c.value}
                    onClick={() => setRecipientCategory(c.value)}
                  />
                ))}
              </div>
            </div>

            <div>
              <SectionHeader n={(sectionN += 1)} title="Método de entrega" />
              <div className="chip-row">
                {deliveryChips.map((m) => (
                  <Chip
                    key={m.value}
                    emoji={m.emoji}
                    text={m.text}
                    selected={deliveryMethod === m.value}
                    onClick={() => setDeliveryMethod(m.value)}
                    wide
                  />
                ))}
              </div>
            </div>

            {corporateAccount && (
              <div>
                <SectionHeader n={(sectionN += 1)} title="Doar como" />
                <Select
                  label="Doar como"
                  hideLabel
                  value={isCorporateDonation ? 'corporate' : 'personal'}
                  onChange={(e) => setIsCorporateDonation(e.target.value === 'corporate')}
                >
                  <option value="personal">Doação Pessoal</option>
                  <option value="corporate">Doação da Empresa ({corporateAccount.Company_Name})</option>
                </Select>
              </div>
            )}

            <div>
              <SectionHeader n={(sectionN += 1)} title="Cidade (opcional)" />
              <Input label="Cidade" hideLabel placeholder="Ex: Luanda" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>

            <div className="field">
              <SectionHeader n={(sectionN += 1)} title="Fotografia da doação" />
              {photoPreview ? (
                <div className="photo-preview-wrap">
                  <img
                    src={photoPreview}
                    alt="Pré-visualização da doação"
                    style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 'var(--radius-md)', display: 'block' }}
                  />
                  <button
                    type="button"
                    className="photo-remove-btn"
                    onClick={() => {
                      onPhotoChange(null);
                      const input = document.getElementById('photo-input') as HTMLInputElement | null;
                      if (input) input.value = '';
                    }}
                    aria-label="Remover fotografia"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <label htmlFor="photo-input" className="upload-well" style={{ cursor: 'pointer', display: 'block' }}>
                  📷 Adicionar fotografia
                  <br />
                  <span style={{ fontSize: 11.5, color: 'var(--color-text-faint)' }}>PNG, JPG até 8MB</span>
                </label>
              )}
              <input
                id="photo-input"
                type="file"
                accept="image/*"
                style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }}
                onChange={(e) => onPhotoChange(e.target.files?.[0] ?? null)}
              />
            </div>

            <div className="field">
              {locationStatus === 'capturing' && <span className="hint">A obter a sua localização…</span>}
              {(locationStatus === 'captured' || locationStatus === 'geocoded') && (
                <div className="location-pill">
                  <span>📍</span>
                  <div>
                    <p className="location-pill-title" style={{ margin: 0 }}>
                      Localização confirmada
                    </p>
                    <p className="location-pill-hint" style={{ margin: 0 }}>
                      Usada apenas para conectar a doação a instituições próximas — a sua privacidade é respeitada.
                    </p>
                  </div>
                </div>
              )}
              {(locationStatus === 'failed' || locationStatus === 'geocoding') && (
                <span className="hint">
                  Não foi possível obter a sua localização automaticamente. Indique a morada de recolha.
                </span>
              )}
              {/*
                RC1 pickup-location fix, 2026-08-07 — always sent as Address,
                collapsed by default only when GPS already succeeded. A map
                pin alone leaves the institution no way to identify the exact
                spot or override where the browser's GPS placed the donor.
              */}
              {!addressExpanded && (locationStatus === 'captured' || locationStatus === 'geocoded') ? (
                <button type="button" className="address-toggle" onClick={() => setAddressExpanded(true)}>
                  + Adicionar morada ou referência de recolha (opcional)
                </button>
              ) : (
                <div className="stack" style={{ gap: 8 }}>
                  <Input
                    label={
                      locationStatus === 'failed' || locationStatus === 'geocoding'
                        ? 'Morada de recolha'
                        : 'Morada / referência de recolha (opcional)'
                    }
                    placeholder="Ex: Rua Amílcar Cabral 23, apto 4B, portão azul"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={onFindAddress}
                    disabled={locationStatus === 'geocoding'}
                  >
                    {locationStatus === 'geocoding'
                      ? 'A localizar…'
                      : hasValidLocation
                        ? 'Recolher nesta morada em vez do GPS'
                        : 'Confirmar morada'}
                  </Button>
                  {locationError && <div className="banner banner-error">{locationError}</div>}
                </div>
              )}
            </div>

            {error && <div className="banner banner-error">{error}</div>}

            <Button type="submit" variant="cta" fullWidth disabled={submitting}>
              {submitting ? 'A submeter…' : '❤️ Confirmar doação'}
            </Button>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
