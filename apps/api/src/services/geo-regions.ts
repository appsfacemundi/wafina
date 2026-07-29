import type { GeoLevel, GeoRegion } from '@wafina/shared';
import { SHEET_TABS } from '../config/sheet-tabs';
import { fromSheetBool } from '../config/sheet-values';
import { findRow, getRows } from '../config/sheets';

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
 * Donor/Institution-facing country picker (onboarding, registration, Settings'
 * Active Country switch). Only Active=TRUE countries are offered — this is the
 * lever that lets Admin "launch" a new market by flipping one flag, no redeploy.
 */
export async function listActiveCountries(): Promise<GeoRegion[]> {
  const rows = await getRows(SHEET_TABS.geoRegions);
  return rows
    .filter((row) => row.Level === 'Country' && fromSheetBool(row.Active ?? ''))
    .map(rowToGeoRegion);
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
