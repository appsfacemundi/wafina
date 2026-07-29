/**
 * Reference set of administrative levels for building pickers/labels — not a
 * server-enforced closed list. Geo_Regions.Level is a plain string precisely so
 * a country whose real administrative structure doesn't match this set (e.g. a
 * level this list doesn't name) can still be represented without a schema or
 * enum change. See packages/shared/src/types/geo-region.ts.
 */
export const GEO_LEVELS = ['Country', 'Province', 'Municipality', 'District'] as const;
export type GeoLevel = (typeof GEO_LEVELS)[number];
