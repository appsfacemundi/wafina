import { google, sheets_v4 } from 'googleapis';
import { ConfigurationError } from './configuration-error';
import { env, isSheetsConfigured } from './env';

/**
 * Thin, generic Google Sheets client keyed by each tab's own header row —
 * mirrors how AppSheet itself reads the same sheet. Module 3 builds the full
 * per-entity data-access layer (validation, uniqueness, cascades) on top of
 * these two primitives rather than introducing a second client.
 */

let client: sheets_v4.Sheets | null = null;

function getClient(): sheets_v4.Sheets {
  if (!isSheetsConfigured()) {
    throw new ConfigurationError(
      'Google Sheets is not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, and GOOGLE_SHEETS_SPREADSHEET_ID.',
    );
  }

  if (!client) {
    const auth = new google.auth.JWT({
      email: env.googleSheets.serviceAccountEmail,
      key: env.googleSheets.serviceAccountPrivateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    client = google.sheets({ version: 'v4', auth });
  }

  return client;
}

/**
 * Some tabs in the live sheet have stray leading/trailing whitespace in header
 * cells (e.g. "Donation_ID " with a trailing space). Trimming here — rather
 * than editing the live sheet's header text — avoids any risk of breaking
 * AppSheet views/actions that may already be bound to the exact original text.
 */
function trimHeader(header: string[]): string[] {
  return header.map((cell) => cell.trim());
}

async function getHeader(tab: string): Promise<string[]> {
  const sheets = getClient();
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: env.googleSheets.spreadsheetId!,
    range: `${tab}!1:1`,
  });
  return trimHeader((data.values?.[0] as string[] | undefined) ?? []);
}

/** Reads a whole tab as row objects keyed by its header row. */
export async function getRows(tab: string): Promise<Record<string, string>[]> {
  const sheets = getClient();
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: env.googleSheets.spreadsheetId!,
    range: tab,
  });

  const [rawHeader, ...rows] = (data.values as string[][] | undefined) ?? [];
  if (!rawHeader) return [];
  const header = trimHeader(rawHeader);

  return rows.map((row) => Object.fromEntries(header.map((key, i) => [key, row[i] ?? ''])));
}

/** Appends one row, mapping fields onto the tab's existing header column order. */
export async function appendRow(tab: string, row: Record<string, string>): Promise<void> {
  const sheets = getClient();
  const header = await getHeader(tab);
  const values = [header.length > 0 ? header.map((key) => row[key] ?? '') : Object.values(row)];

  await sheets.spreadsheets.values.append({
    spreadsheetId: env.googleSheets.spreadsheetId!,
    range: tab,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });
}

/** Returns the first row matching `predicate`, or null. */
export async function findRow(
  tab: string,
  predicate: (row: Record<string, string>) => boolean,
): Promise<Record<string, string> | null> {
  const rows = await getRows(tab);
  return rows.find(predicate) ?? null;
}

/** Converts a 1-based column count into its A1 letter (27 -> "AA"). */
function columnLetter(count: number): string {
  let result = '';
  let n = count;
  while (n > 0) {
    const remainder = (n - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

/**
 * Finds the row whose `keyColumn` equals `keyValue` and overwrites only the
 * columns present in `patch`, leaving the rest of the row untouched.
 */
export async function updateRow(
  tab: string,
  keyColumn: string,
  keyValue: string,
  patch: Record<string, string>,
): Promise<void> {
  const sheets = getClient();
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: env.googleSheets.spreadsheetId!,
    range: tab,
  });

  const [rawHeader, ...rows] = (data.values as string[][] | undefined) ?? [];
  if (!rawHeader) {
    throw new Error(`Cannot update "${tab}": sheet has no header row`);
  }
  const header = trimHeader(rawHeader);

  const keyIndex = header.indexOf(keyColumn);
  if (keyIndex === -1) {
    throw new Error(`Column "${keyColumn}" not found in "${tab}" header`);
  }

  const rowIndex = rows.findIndex((row) => row[keyIndex] === keyValue);
  if (rowIndex === -1) {
    throw new Error(`No row in "${tab}" where ${keyColumn}=${keyValue}`);
  }

  const existingRow = rows[rowIndex];
  const merged = header.map((key, i) => patch[key] ?? existingRow[i] ?? '');

  // +2: 1-based Sheets rows, plus the header row itself.
  const targetRow = rowIndex + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: env.googleSheets.spreadsheetId!,
    range: `${tab}!A${targetRow}:${columnLetter(header.length)}${targetRow}`,
    valueInputOption: 'RAW',
    requestBody: { values: [merged] },
  });
}
