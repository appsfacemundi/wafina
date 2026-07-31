/**
 * Production hardening (2026-07-31) — the Google Sheet is the entire
 * production database and had no backup mechanism at all. This exports
 * every tab to timestamped JSON files, independent of whatever hosting
 * provider ends up running the API (that decision is still open — see
 * WAFINA_PILOT_LAUNCH_CHECKLIST.md).
 *
 * Reuses the same hardened `getRows()` from config/sheets.ts, so each tab
 * read already gets retry-with-backoff on Sheets 429s for free. One tab
 * failing (e.g. quota exhausted even after retries) is logged and skipped
 * rather than aborting the whole backup — a partial backup of 9 tabs beats
 * none at all.
 *
 * Usage: `npm run backup --workspace=apps/api`
 * Output: apps/api/backups/<ISO-timestamp>/<Tab_Name>.json, plus a
 * manifest.json with row counts and any per-tab errors.
 *
 * This directory is git-ignored. For a real production schedule, wire this
 * command into the host's own cron/scheduled-task mechanism (e.g. a daily
 * cron job) and point its output at persistent storage — most PaaS hosts
 * have ephemeral local disks, so a local-only backup is only as durable as
 * the next deploy. That wiring is a deployment-host decision, not something
 * this script can decide on the stakeholder's behalf.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { env } from '../src/config/env';
import { SHEET_TABS } from '../src/config/sheet-tabs';
import { getRows } from '../src/config/sheets';

async function main(): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = join(__dirname, '..', 'backups', timestamp);
  mkdirSync(outDir, { recursive: true });

  const manifest: {
    timestamp: string;
    spreadsheetId: string | undefined;
    tabs: Record<string, { rows: number; error?: string }>;
  } = {
    timestamp,
    spreadsheetId: env.googleSheets.spreadsheetId,
    tabs: {},
  };

  for (const tab of Object.values(SHEET_TABS)) {
    try {
      const rows = await getRows(tab);
      writeFileSync(join(outDir, `${tab}.json`), JSON.stringify(rows, null, 2));
      manifest.tabs[tab] = { rows: rows.length };
      console.log(`  OK   ${tab}: ${rows.length} rows`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      manifest.tabs[tab] = { rows: 0, error: message };
      console.error(`  FAIL ${tab}: ${message}`);
    }
  }

  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  const failed = Object.values(manifest.tabs).filter((t) => t.error).length;
  console.log(`\nBackup written to ${outDir}`);
  console.log(failed > 0 ? `${failed} tab(s) failed — see manifest.json` : 'All tabs backed up successfully.');
}

main().catch((err) => {
  console.error('Backup failed to run:', err);
  process.exitCode = 1;
});
