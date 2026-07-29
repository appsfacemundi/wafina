'use client';

import { detectSupportedCountryFromCoords, type GeoRegion } from '@wafina/shared';
import { Button, Card } from '@wafina/ui';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';

/**
 * Phase 3A Module 1 — the GPS-assisted switch-country prompt, web equivalent
 * of the mobile component. Runs once per session on Home mount. GPS is only
 * ever a suggestion: nothing here changes Active_Country_ID without the user
 * clicking "Switch now".
 */
export function SwitchCountryPrompt() {
  const { firebaseUser, session, refreshSession } = useAuth();
  const [detected, setDetected] = useState<GeoRegion | null>(null);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    if (!session?.activeCountryId || session.switchPreference === 'Never_Ask_Automatically') return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    checkedRef.current = true;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const isoCode = detectSupportedCountryFromCoords(
            position.coords.latitude,
            position.coords.longitude,
          );
          if (!isoCode) return;

          const idToken = await firebaseUser?.getIdToken();
          const countries = await apiFetch<GeoRegion[]>('/geo-regions/countries', { idToken });
          const match = countries.find((c) => c.ISO_Code === isoCode);
          if (match && match.Region_ID !== session.activeCountryId) {
            setDetected(match);
          }
        } catch {
          // Silent — nice-to-have prompt, never worth surfacing an error for.
        }
      },
      () => {
        // Permission denied or unavailable — silently skip, never force it.
      },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }, [session, firebaseUser]);

  async function switchNow() {
    if (!detected) return;
    const idToken = await firebaseUser?.getIdToken();
    await apiFetch('/users/me/active-country', {
      method: 'PATCH',
      idToken,
      body: { countryId: detected.Region_ID },
    });
    await refreshSession();
    setDetected(null);
  }

  async function neverAskAgain() {
    const idToken = await firebaseUser?.getIdToken();
    await apiFetch('/users/me/switch-preference', {
      method: 'PATCH',
      idToken,
      body: { preference: 'Never_Ask_Automatically' },
    });
    await refreshSession();
    setDetected(null);
  }

  if (!detected) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(24, 17, 23, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
        zIndex: 50,
      }}
    >
      <Card className="stack" style={{ maxWidth: 380 }}>
        <p style={{ fontWeight: 600, fontSize: 18 }}>Detetámos uma mudança de país</p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
          Parece que está atualmente em {detected.Name}. Mudar o seu país ativo para {detected.Name}?
        </p>
        <Button onClick={switchNow} fullWidth>
          Mudar agora
        </Button>
        <Button variant="secondary" onClick={() => setDetected(null)} fullWidth>
          Agora não
        </Button>
        <Button variant="ghost" onClick={neverAskAgain} fullWidth>
          Nunca perguntar automaticamente
        </Button>
      </Card>
    </div>
  );
}
