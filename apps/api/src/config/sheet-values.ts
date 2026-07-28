/**
 * Serialization conventions for how AppSheet/Sheets store typed values as
 * plain text cells. Centralized here so if the live sheet turns out to use a
 * different convention (e.g. a locale-specific date format), there's exactly
 * one place to fix it.
 */

export function nowIso(): string {
  return new Date().toISOString();
}

/** Google Sheets boolean cells serialize as the literal strings TRUE/FALSE. */
export function toSheetBool(value: boolean): string {
  return value ? 'TRUE' : 'FALSE';
}

export function fromSheetBool(value: string): boolean {
  return value.trim().toUpperCase() === 'TRUE';
}

/**
 * AppSheet LatLong columns serialize as "lat,lng" text.
 * TODO: confirm this against the live sheet once Sheets access exists.
 */
export function toSheetLatLong(point: { lat: number; lng: number }): string {
  return `${point.lat},${point.lng}`;
}

export function fromSheetLatLong(value: string): { lat: number; lng: number } | null {
  const [latStr, lngStr] = value.split(',').map((v) => v.trim());
  const lat = Number(latStr);
  const lng = Number(lngStr);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}
