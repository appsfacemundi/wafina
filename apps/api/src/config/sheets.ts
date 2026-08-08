import { google, sheets_v4 } from 'googleapis';
import { ConfigurationError } from './configuration-error';
import { env, isSheetsConfigured } from './env';
import { TransientServiceError } from '../services/transient-service-error';

/**
 * Thin, generic Google Sheets client keyed by each tab's own header row —
 * mirrors how AppSheet itself reads the same sheet. Module 3 builds the full
 * per-entity data-access layer (validation, uniqueness, cascades) on top of
 * these two primitives rather than introducing a second client.
 */

let client: sheets_v4.Sheets | null = null;

const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 500; // 500, 1000, 2000 between the 4 attempts

/**
 * Reliability fix, 2026-08-07 — every "list X" service call re-reads its
 * whole tab from Sheets, and a single Admin page load fans out several of
 * these in parallel (donations, users, countries, stats...). Under repeated
 * fast reloads that burns through Sheets' per-minute quota well before the
 * retry/backoff above gets a chance to help, surfacing as user-facing 503s.
 * A short TTL cache in front of getRows absorbs that burst — real writes
 * still land immediately (updateRow/appendRow evict the tab they touch), so
 * the only staleness a caller can ever see is "up to CACHE_TTL_MS old", never
 * "missed my own write."
 */
const CACHE_TTL_MS = 20_000;
const rowsCache = new Map<string, { data: Record<string, string>[]; expiresAt: number }>();

function invalidateTab(tab: string): void {
  rowsCache.delete(tab);
}

/** True for a Google Sheets per-minute read/write quota error (429 / RESOURCE_EXHAUSTED). */
function isRateLimitError(err: unknown): boolean {
  const e = err as { code?: number | string; status?: number; response?: { status?: number } };
  return e?.code === 429 || e?.status === 429 || e?.response?.status === 429;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Stabilization follow-up (2026-07-31, stakeholder-requested) — Google
 * Sheets' per-minute quota is real and gets hit during bursts of rapid
 * activity (documented earlier as the root cause of a production incident,
 * and again during this session's own rapid automated testing). Every raw
 * Sheets API call in this file goes through this wrapper so a transient 429
 * is retried with exponential backoff and, in the common case, never
 * reaches the client as an error at all. Only after MAX_ATTEMPTS attempts
 * does it surface — as a TransientServiceError with a plain-language
 * message, not the raw Google error — so the user sees "try again in a
 * moment" instead of "Internal server error" for what is, from their
 * perspective, a temporary backend hiccup.
 */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isLastAttempt = attempt === MAX_ATTEMPTS - 1;
      if (!isRateLimitError(err)) throw err;
      if (isLastAttempt) {
        throw new TransientServiceError(
          'O sistema está temporariamente ocupado. Por favor, tente novamente dentro de alguns instantes.',
        );
      }
      await sleep(BASE_DELAY_MS * 2 ** attempt);
    }
  }
  // Unreachable — the loop above always returns or throws.
  throw new TransientServiceError('O sistema está temporariamente ocupado. Por favor, tente novamente dentro de alguns instantes.');
}

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
  const { data } = await withRetry(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId: env.googleSheets.spreadsheetId!,
      range: `${tab}!1:1`,
    }),
  );
  return trimHeader((data.values?.[0] as string[] | undefined) ?? []);
}

/** Reads a whole tab as row objects keyed by its header row. Served from a short TTL cache when fresh. */
export async function getRows(tab: string): Promise<Record<string, string>[]> {
  const cached = rowsCache.get(tab);
  if (cached && cached.expiresAt > Date.now()) return [...cached.data];

  const sheets = getClient();
  const { data } = await withRetry(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId: env.googleSheets.spreadsheetId!,
      range: tab,
    }),
  );

  const [rawHeader, ...rows] = (data.values as string[][] | undefined) ?? [];
  if (!rawHeader) return [];
  const header = trimHeader(rawHeader);

  const parsed = rows.map((row) => Object.fromEntries(header.map((key, i) => [key, row[i] ?? ''])));
  rowsCache.set(tab, { data: parsed, expiresAt: Date.now() + CACHE_TTL_MS });
  return [...parsed];
}

/** Appends one row, mapping fields onto the tab's existing header column order. */
export async function appendRow(tab: string, row: Record<string, string>): Promise<void> {
  const sheets = getClient();
  const header = await getHeader(tab);
  const values = [header.length > 0 ? header.map((key) => row[key] ?? '') : Object.values(row)];

  await withRetry(() =>
    sheets.spreadsheets.values.append({
      spreadsheetId: env.googleSheets.spreadsheetId!,
      range: tab,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values },
    }),
  );
  invalidateTab(tab);
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
  const { data } = await withRetry(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId: env.googleSheets.spreadsheetId!,
      range: tab,
    }),
  );

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
  await withRetry(() =>
    sheets.spreadsheets.values.update({
      spreadsheetId: env.googleSheets.spreadsheetId!,
      range: `${tab}!A${targetRow}:${columnLetter(header.length)}${targetRow}`,
      valueInputOption: 'RAW',
      requestBody: { values: [merged] },
    }),
  );
  invalidateTab(tab);
}
