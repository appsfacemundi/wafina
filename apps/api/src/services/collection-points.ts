import type { CollectionPoint } from '@wafina/shared';
import { SHEET_TABS } from '../config/sheet-tabs';
import { findRow, getRows } from '../config/sheets';

function rowToCollectionPoint(row: Record<string, string>): CollectionPoint {
  return {
    Collection_Point_ID: row.Collection_Point_ID,
    Country_ID: row.Country_ID,
    Name: row.Name,
    Address: row.Address,
    City: row.City || null,
    Phone: row.Phone || null,
    Email: row.Email || null,
    Opening_Hours: row.Opening_Hours || null,
    Directions: row.Directions || null,
  };
}

/**
 * RECEBER collection-point flow — one row per country; returns null (never
 * invented data) when a country has no collection point configured yet.
 * Country_ID-keyed lookup only, so a future country needs a new row, not a
 * code change.
 */
export async function getCollectionPointForCountry(countryId: string): Promise<CollectionPoint | null> {
  const row = await findRow(SHEET_TABS.collectionPoints, (r) => r.Country_ID === countryId);
  return row ? rowToCollectionPoint(row) : null;
}

/**
 * Admin collection-code visibility, 2026-08-10 — batched lookup for the
 * Admin donations page, so displaying N active reservations' collection
 * points costs one Sheets read total, not N.
 */
export async function listCollectionPoints(): Promise<CollectionPoint[]> {
  const rows = await getRows(SHEET_TABS.collectionPoints);
  return rows.map(rowToCollectionPoint);
}
