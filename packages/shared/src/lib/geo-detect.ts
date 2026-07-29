/**
 * Coarse, free, on-device country inference from GPS coordinates — Phase 3A
 * Module 1's switch-country prompt only needs to distinguish among the small,
 * closed set of countries Wafina actually operates in, not do full worldwide
 * reverse geocoding. A real geocoding API is a straightforward upgrade later
 * if this proves insufficiently accurate; not worth the dependency until then.
 *
 * Bounding boxes are intentionally generous (they may overlap slightly at
 * borders) — a false "you might be in X" prompt the user dismisses with "Not
 * now" costs nothing; the only real cost is silent auto-switching, which the
 * app never does regardless of this function's answer.
 */

interface CountryBounds {
  isoCode: string;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

const SUPPORTED_COUNTRY_BOUNDS: CountryBounds[] = [
  { isoCode: 'AO', minLat: -18.04, maxLat: -4.35, minLng: 11.4, maxLng: 24.09 }, // Angola
  { isoCode: 'PT', minLat: 36.9, maxLat: 42.16, minLng: -9.53, maxLng: -6.19 }, // Portugal (mainland)
  { isoCode: 'BR', minLat: -33.75, maxLat: 5.27, minLng: -73.99, maxLng: -34.79 }, // Brazil
  { isoCode: 'MZ', minLat: -26.87, maxLat: -10.47, minLng: 30.21, maxLng: 40.85 }, // Moçambique
  { isoCode: 'CV', minLat: 14.8, maxLat: 17.2, minLng: -25.36, maxLng: -22.65 }, // Cabo Verde
];

/** Returns the ISO code of a Wafina-supported country whose bounding box contains the point, or null. */
export function detectSupportedCountryFromCoords(lat: number, lng: number): string | null {
  const match = SUPPORTED_COUNTRY_BOUNDS.find(
    (b) => lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng,
  );
  return match?.isoCode ?? null;
}
