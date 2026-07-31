import { randomUUID } from 'node:crypto';
import type { GeoLevel, GeoRegion } from '@wafina/shared';
import { SHEET_TABS } from '../config/sheet-tabs';
import { fromSheetBool, toSheetBool } from '../config/sheet-values';
import { appendRow, findRow, getRows, updateRow } from '../config/sheets';
import { ValidationError } from './validation-error';

function rowToGeoRegion(row: Record<string, string>): GeoRegion {
  return {
    Region_ID: row.Region_ID,
    Name: row.Name,
    Level: row.Level as GeoLevel,
    Parent_Region_ID: row.Parent_Region_ID || null,
    Country_ID: row.Country_ID,
    ISO_Code: row.ISO_Code || null,
    Active: fromSheetBool(row.Active ?? ''),
  };
}

/**
 * Donor/Institution-facing country picker (onboarding, registration, Home
 * Country). Only Active=TRUE countries are offered — this is the lever that
 * lets Admin "launch" a new market by flipping one flag, no redeploy.
 */
export async function listActiveCountries(): Promise<GeoRegion[]> {
  const rows = await getRows(SHEET_TABS.geoRegions);
  return rows
    .filter((row) => row.Level === 'Country' && fromSheetBool(row.Active ?? ''))
    .map(rowToGeoRegion);
}

/**
 * Every Country-level row, active or not — backs the Settings "Active Country"
 * selector, which shows not-yet-launched countries as "Coming Soon" rather
 * than hiding them (so the UI needs no redesign the day one launches).
 * Distinct from listActiveCountries(): this must NEVER be used to validate or
 * populate a field that requires a real, currently-launched country.
 */
export async function listAllCountries(): Promise<GeoRegion[]> {
  const rows = await getRows(SHEET_TABS.geoRegions);
  return rows
    .filter((row) => row.Level === 'Country')
    .map(rowToGeoRegion)
    .sort((a, b) => {
      if (a.Active !== b.Active) return a.Active ? -1 : 1;
      return a.Name.localeCompare(b.Name, 'pt');
    });
}

export async function getRegionById(regionId: string): Promise<GeoRegion | null> {
  const row = await findRow(SHEET_TABS.geoRegions, (r) => r.Region_ID === regionId);
  return row ? rowToGeoRegion(row) : null;
}

/** Province/Municipality/District rows directly under a given region — empty until that depth exists. */
export async function listChildRegions(parentRegionId: string): Promise<GeoRegion[]> {
  const rows = await getRows(SHEET_TABS.geoRegions);
  return rows.filter((row) => row.Parent_Region_ID === parentRegionId).map(rowToGeoRegion);
}

/** True only if the region exists, is a Country-level row, and is currently launched. */
export async function isActiveCountry(regionId: string): Promise<boolean> {
  const region = await getRegionById(regionId);
  return Boolean(region && region.Level === 'Country' && region.Active);
}

/**
 * Admin parity Phase A — the write side of the "launch a country by flipping
 * one flag" lever the type/read-side comments already describe. No route
 * existed to actually flip it before this.
 */
export async function setCountryActive(regionId: string, active: boolean): Promise<GeoRegion> {
  const region = await getRegionById(regionId);
  if (!region || region.Level !== 'Country') throw new ValidationError('Country not found');
  await updateRow(SHEET_TABS.geoRegions, 'Region_ID', regionId, { Active: toSheetBool(active) });
  return { ...region, Active: active };
}

/** Admin-only — adds a brand-new Country-level row (Coming Soon by default until explicitly activated). */
export async function createCountry(name: string, isoCode: string): Promise<GeoRegion> {
  if (!name.trim()) throw new ValidationError('Country name is required');
  if (!isoCode.trim() || isoCode.trim().length !== 2) {
    throw new ValidationError('ISO code must be a 2-letter country code');
  }

  const regionId = randomUUID();
  const row = {
    Region_ID: regionId,
    Name: name.trim(),
    Level: 'Country' satisfies GeoLevel,
    Parent_Region_ID: '',
    Country_ID: regionId,
    ISO_Code: isoCode.trim().toUpperCase(),
    Active: toSheetBool(false),
  };
  await appendRow(SHEET_TABS.geoRegions, row);
  return rowToGeoRegion(row as unknown as Record<string, string>);
}
