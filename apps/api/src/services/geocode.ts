import { ValidationError } from './validation-error';

/**
 * Stabilization module (2026-07-31) — normal users should never have to know
 * or type GPS coordinates. GPS is tried automatically first (client-side);
 * this is the fallback path when GPS is denied/unavailable — the user types
 * a real address instead, and this converts it to coordinates server-side.
 *
 * Uses OpenStreetMap's free Nominatim service — no API key, no billing setup
 * required from the stakeholder, appropriate for this platform's real-world
 * volume. Deliberately NOT the Google Geocoding API: that would require the
 * stakeholder to enable billing on their Google Cloud project, a real
 * external dependency/cost decision that shouldn't be made without them.
 * Nominatim's usage policy (max ~1 request/sec, a real identifying
 * User-Agent, no heavy commercial use) is more than sufficient for this
 * app's expected traffic; called server-side (not from the browser) both to
 * set that User-Agent correctly and to avoid CORS entirely.
 */
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number }> {
  if (!address || !address.trim()) {
    throw new ValidationError('Address is required');
  }

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address.trim())}`;
  const response = await fetch(url, {
    headers: {
      // Required by Nominatim's usage policy — identifies the app, not a browser UA.
      'User-Agent': 'WafinaPlatform/1.0 (donation-matching platform)',
    },
  });

  if (!response.ok) {
    throw new Error(`Geocoding service returned ${response.status}`);
  }

  const results = (await response.json()) as Array<{ lat: string; lon: string }>;
  if (!results.length) {
    // User-facing (not a dev/edge-case error like the rest of this codebase's
    // ValidationErrors) — a real donor mistyping their address is the
    // expected, frequent path here, so this one is in Portuguese directly.
    throw new ValidationError('Endereço não encontrado. Tente uma morada mais específica.');
  }

  const { lat, lon } = results[0];
  return { lat: Number(lat), lng: Number(lon) };
}
