/**
 * Country-routing fix, 2026-08-10 — converts an ISO 3166-1 alpha-2 code
 * (e.g. "AO", "PT") into its flag emoji via the standard Unicode Regional
 * Indicator Symbol trick (each letter A-Z maps to U+1F1E6..U+1F1FF, offset
 * by the same amount from its ASCII code point). Deliberately generic: no
 * per-country lookup table, so a newly-launched country's flag renders
 * correctly the moment it has an ISO_Code in Geo_Regions — no code change
 * needed when the platform adds a country.
 */
export function countryFlagEmoji(isoCode: string | null | undefined): string {
  if (!isoCode || isoCode.length !== 2) return '';
  const codePoints = [...isoCode.toUpperCase()].map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}
