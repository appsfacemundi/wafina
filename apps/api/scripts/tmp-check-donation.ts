import { SHEET_TABS } from '../src/config/sheet-tabs';
import { getRows } from '../src/config/sheets';

async function main() {
  const rows = await getRows(SHEET_TABS.donations);
  const row = rows.find((r) => r.Donation_ID === '9dc1ca8d-ee9b-4773-a779-25daafce9ca1');
  console.log(JSON.stringify(row, null, 2));
}
main().then(() => process.exit(0));
