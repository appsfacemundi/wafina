/**
 * One-time Phase 3A Module 1 schema setup against the real production sheet:
 *  1. Create the Geo_Regions tab (if missing) and seed Country-level rows.
 *  2. Add new header columns to Users / Institutions / Donations (additive only
 *     — never removes or reorders existing columns, so AppSheet/Admin views
 *     bound to the current layout are untouched).
 *  3. Backfill existing rows so nothing is left with a blank Country_ID.
 *
 * Safe to re-run: every step checks current state first and skips what's
 * already done.
 */
import { randomUUID } from 'node:crypto';
import { google, sheets_v4 } from 'googleapis';
import { env } from '../src/config/env';
import { SHEET_TABS } from '../src/config/sheet-tabs';
import { toSheetBool } from '../src/config/sheet-values';
import { appendRow, getRows, updateRow } from '../src/config/sheets';

function getClient(): sheets_v4.Sheets {
  const auth = new google.auth.JWT({
    email: env.googleSheets.serviceAccountEmail,
    key: env.googleSheets.serviceAccountPrivateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

const SPREADSHEET_ID = env.googleSheets.spreadsheetId!;

async function tabExists(sheets: sheets_v4.Sheets, title: string): Promise<boolean> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  return (meta.data.sheets ?? []).some((s) => s.properties?.title === title);
}

async function createTab(sheets: sheets_v4.Sheets, title: string, header: string[]): Promise<void> {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests: [{ addSheet: { properties: { title } } }] },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${title}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [header] },
  });
  console.log(`Created tab "${title}" with header:`, header);
}

/** Appends new column headers to an existing tab's row 1, after whatever is already there. */
async function addMissingColumns(
  sheets: sheets_v4.Sheets,
  tab: string,
  newColumns: string[],
): Promise<void> {
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tab}!1:1`,
  });
  const existingHeader = (data.values?.[0] as string[] | undefined)?.map((h) => h.trim()) ?? [];
  const toAdd = newColumns.filter((c) => !existingHeader.includes(c));
  if (toAdd.length === 0) {
    console.log(`"${tab}" already has all columns: ${newColumns.join(', ')}`);
    return;
  }
  const startCol = existingHeader.length + 1;
  const endCol = existingHeader.length + toAdd.length;
  const colLetter = (n: number) => {
    let s = '';
    while (n > 0) {
      const r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  };
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tab}!${colLetter(startCol)}1:${colLetter(endCol)}1`,
    valueInputOption: 'RAW',
    requestBody: { values: [toAdd] },
  });
  console.log(`Added columns to "${tab}":`, toAdd);
}

async function main() {
  const sheets = getClient();

  // --- Step 1: Geo_Regions tab + seed data ---
  const geoTab = SHEET_TABS.geoRegions;
  if (!(await tabExists(sheets, geoTab))) {
    await createTab(sheets, geoTab, [
      'Region_ID',
      'Name',
      'Level',
      'Parent_Region_ID',
      'Country_ID',
      'ISO_Code',
      'Active',
    ]);
  } else {
    console.log(`Tab "${geoTab}" already exists — skipping creation.`);
  }

  const existingRegions = await getRows(geoTab);
  const countriesToSeed: { name: string; iso: string; active: boolean }[] = [
    { name: 'Angola', iso: 'AO', active: true },
    { name: 'Portugal', iso: 'PT', active: false },
    { name: 'Brasil', iso: 'BR', active: false },
    { name: 'Moçambique', iso: 'MZ', active: false },
    { name: 'Cabo Verde', iso: 'CV', active: false },
  ];

  const countryIdByIso: Record<string, string> = {};
  for (const row of existingRegions) {
    if (row.Level === 'Country' && row.ISO_Code) countryIdByIso[row.ISO_Code] = row.Region_ID;
  }

  for (const c of countriesToSeed) {
    if (countryIdByIso[c.iso]) {
      console.log(`Country ${c.name} (${c.iso}) already seeded — skipping.`);
      continue;
    }
    const regionId = randomUUID();
    await appendRow(geoTab, {
      Region_ID: regionId,
      Name: c.name,
      Level: 'Country',
      Parent_Region_ID: '',
      Country_ID: regionId, // a Country row points to itself (the denormalization rule)
      ISO_Code: c.iso,
      Active: toSheetBool(c.active),
    });
    countryIdByIso[c.iso] = regionId;
    console.log(`Seeded country ${c.name} (${c.iso}) -> ${regionId}, Active=${c.active}`);
  }

  const angolaId = countryIdByIso['AO'];
  if (!angolaId) throw new Error('Angola row missing after seed — aborting backfill.');

  // --- Step 2: add new columns to existing tabs (additive only) ---
  await addMissingColumns(sheets, SHEET_TABS.users, [
    'Home_Country_ID',
    'Active_Country_ID',
    'Switch_Preference',
  ]);
  await addMissingColumns(sheets, SHEET_TABS.institutions, [
    'Country_ID',
    'Region_ID',
    'Service_Radius_Km',
    'Coverage_Area',
  ]);
  await addMissingColumns(sheets, SHEET_TABS.donations, ['Country_ID']);

  // --- Step 3: backfill existing rows ---
  // All current data predates multi-country and is Angola-only (spec 1.5.1:
  // Angola is the sole launched market) — every existing row backfills to Angola.
  const users = await getRows(SHEET_TABS.users);
  for (const row of users) {
    if (row.Home_Country_ID?.trim()) continue; // already backfilled
    await updateRow(SHEET_TABS.users, 'User_ID', row.User_ID, {
      Home_Country_ID: angolaId,
      Active_Country_ID: angolaId,
      Switch_Preference: 'Always_Ask',
    });
    console.log(`Backfilled User ${row.User_ID} (was Country="${row.Country ?? ''}") -> Angola`);
  }

  const institutions = await getRows(SHEET_TABS.institutions);
  for (const row of institutions) {
    if (row.Country_ID?.trim()) continue;
    await updateRow(SHEET_TABS.institutions, 'Institution_ID', row.Institution_ID, {
      Country_ID: angolaId,
    });
    console.log(`Backfilled Institution ${row.Institution_ID} -> Angola`);
  }

  const donations = await getRows(SHEET_TABS.donations);
  for (const row of donations) {
    if (row.Country_ID?.trim()) continue;
    await updateRow(SHEET_TABS.donations, 'Donation_ID', row.Donation_ID, {
      Country_ID: angolaId,
    });
    console.log(`Backfilled Donation ${row.Donation_ID} -> Angola`);
  }

  console.log('Module 1 schema setup + backfill complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
