import { SHEET_TABS } from '../src/config/sheet-tabs';
import { getRows, updateRow } from '../src/config/sheets';

async function main() {
  const institutions = await getRows(SHEET_TABS.institutions);
  const row = institutions.find((i) => i.Name === 'Android Test Institution');
  if (!row) {
    console.log('Institution not found');
    return;
  }
  await updateRow(SHEET_TABS.institutions, 'Institution_ID', row.Institution_ID, { Verified: 'TRUE' });
  console.log('Verified institution:', row.Institution_ID);
}

main().then(() => process.exit(0));
