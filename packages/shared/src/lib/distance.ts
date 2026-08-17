import type { GeoPoint } from '../types/geo-point';

const EARTH_RADIUS_KM = 6371;

/**
 * V2 GPS distance (2026-08-17) — great-circle (straight-line) distance
 * between two points, in km. No existing implementation anywhere in this
 * codebase before this. Deliberately not driving/routing distance —
 * consistent with this codebase's existing no-external-geo-API posture
 * (see services/geocode.ts's Nominatim-not-Google comment): a straight-line
 * number is a "is this even remotely practical" gut-check, not a precise
 * travel estimate, and needs zero new vendors/keys/cost.
 */
export function haversineDistanceKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, h)));
}

export interface DistanceThresholdsKm {
  /** Below this: just show the number, no visual treatment. */
  nearby: number;
  /** Below this: shown plainly, no warning tone. */
  notable: number;
  /** At/above this: confirm dialog appears, neutral/informational tone. */
  warn: number;
  /** At/above this: confirm dialog appears, stronger warning tone/copy. */
  farWarn: number;
}

/**
 * V2 GPS distance (2026-08-17) — stakeholder-approved defaults (10/30/75/150
 * km), reasoned from Portugal's own geography (mainland is ~560km
 * north-south). Deliberately NOT a single hardcoded number inline in any
 * dialog component — see DISTANCE_THRESHOLDS_BY_COUNTRY_KM below for why.
 */
export const DEFAULT_DISTANCE_THRESHOLDS_KM: DistanceThresholdsKm = {
  nearby: 10,
  notable: 30,
  warn: 75,
  farWarn: 150,
};

/**
 * V2 GPS distance (2026-08-17) — stakeholder requirement: a single global
 * threshold set doesn't mean the same thing in every one of the 5 supported
 * countries (Cabo Verde is an island nation where even 30km can mean
 * crossing water between islands; Angola/Moçambique are much larger than
 * Portugal). Keyed by Geo_Regions.ISO_Code so a future country-specific
 * tuning is a config edit here, never a code change or a redesign. Empty by
 * design today — no real usage data yet to justify per-country values;
 * every country falls through to DEFAULT_DISTANCE_THRESHOLDS_KM until one
 * is added here.
 */
export const DISTANCE_THRESHOLDS_BY_COUNTRY_KM: Record<string, DistanceThresholdsKm> = {};

export function getDistanceThresholds(isoCode: string | null | undefined): DistanceThresholdsKm {
  if (isoCode && DISTANCE_THRESHOLDS_BY_COUNTRY_KM[isoCode]) {
    return DISTANCE_THRESHOLDS_BY_COUNTRY_KM[isoCode];
  }
  return DEFAULT_DISTANCE_THRESHOLDS_KM;
}

export type DistanceTier = 'nearby' | 'notable' | 'warn' | 'farWarn';

/** Which visual/behavioral tier a distance falls into for a given country's thresholds. */
export function getDistanceTier(distanceKm: number, thresholds: DistanceThresholdsKm): DistanceTier {
  if (distanceKm >= thresholds.farWarn) return 'farWarn';
  if (distanceKm >= thresholds.warn) return 'warn';
  if (distanceKm >= thresholds.notable) return 'notable';
  return 'nearby';
}

/** Convenience: does this distance require an explicit confirm dialog before claiming? */
export function requiresDistanceConfirmation(distanceKm: number, thresholds: DistanceThresholdsKm): boolean {
  return distanceKm >= thresholds.warn;
}
