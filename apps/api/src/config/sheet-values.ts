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

/**
 * Real-device finding, 2026-08-07 — rows created before the custom API (via
 * AppSheet) store dates as locale strings like "7/27/2026"; every row since
 * stores `nowIso()`'s ISO 8601 format. Sorting either kind of date column
 * with `.localeCompare()` (the pattern used throughout this codebase before
 * this fix) silently produces the wrong order whenever both formats are
 * present in the same list — e.g. "7/27/2026" sorts ahead of
 * "2026-08-06T22:28:07.157Z" because '7' > '2' as a first character, even
 * though the ISO date is over a week newer. `Date.parse` understands both
 * formats correctly, so comparing on that instead sorts by real time regardless
 * of which era a row was created in.
 */
export function parseSheetDate(value: string): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}
