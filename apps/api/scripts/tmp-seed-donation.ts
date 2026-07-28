import { randomUUID } from 'node:crypto';
import { SHEET_TABS } from '../src/config/sheet-tabs';
import { appendRow } from '../src/config/sheets';
import { nowIso } from '../src/config/sheet-values';

async function main() {
  const donationId = randomUUID();
  await appendRow(SHEET_TABS.donations, {
    Donation_ID: donationId,
    Donor_ID: 'test-seed-donor-ios',
    Item_Type: 'Roupas',
    Quantity: '5',
    Condition: 'Novo',
    Photo_URL: '',
    Location_lat: '37.78583',
    Location_lng: '-122.40642',
    Status: 'Pending',
    Claimed_By: '',
    Date_Created: nowIso(),
    Date_Claimed: '',
    Date_Delivered: '',
  });
  console.log('Created test donation:', donationId);
}

main().then(() => process.exit(0));
