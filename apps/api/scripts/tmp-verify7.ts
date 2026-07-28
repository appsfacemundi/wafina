import { updateRow } from '../src/config/sheets';
import { SHEET_TABS } from '../src/config/sheet-tabs';
import { createDonation } from '../src/services/donations';

async function main() {
  await updateRow(SHEET_TABS.institutions, 'Institution_ID', '72a763eb-a48b-4ee8-a784-ca6ee6f59cfc', {
    Verified: 'TRUE',
    Locked_Fields: 'Name,Type,Location,Needs_List,Logo',
    Total_Items_Received: '15',
  });
  console.log('Verified test institution');

  const d1 = await createDonation('test-donor-for-module7', {
    Item_Type: 'Roupas', Quantity: 4, Condition: 'Novo',
    Location: { lat: -12.5763, lng: 13.4055 },
    Photo: 'https://drive.google.com/uc?id=fake-test-m7-a',
  });
  const d2 = await createDonation('test-donor-for-module7', {
    Item_Type: 'Material escolar', Quantity: 6, Condition: 'Bom estado',
    Location: { lat: -12.5763, lng: 13.4055 },
    Photo: 'https://drive.google.com/uc?id=fake-test-m7-b',
  });
  console.log('Created donations:', d1.Donation_ID, d2.Donation_ID);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
