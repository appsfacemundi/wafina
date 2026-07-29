import { createInstitution } from '../src/services/institutions';
import { createDonation } from '../src/services/donations';

async function expectThrow(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    console.log(`FAIL (should have thrown): ${label}`);
  } catch (err) {
    console.log(`OK (threw as expected): ${label} ->`, (err as Error).message);
  }
}

async function main() {
  await expectThrow('createInstitution with missing Country_ID', () =>
    createInstitution('fake-user-validation-test', {
      Name: 'Test Institution Validation',
      Type: 'NGO',
      Location: { lat: -8.83, lng: 13.23 },
      Country_ID: '',
    }),
  );

  await expectThrow('createInstitution with bogus Country_ID', () =>
    createInstitution('fake-user-validation-test', {
      Name: 'Test Institution Validation',
      Type: 'NGO',
      Location: { lat: -8.83, lng: 13.23 },
      Country_ID: 'not-a-real-region',
    }),
  );

  await expectThrow('createInstitution with an inactive (Portugal) Country_ID', () =>
    createInstitution('fake-user-validation-test', {
      Name: 'Test Institution Validation',
      Type: 'NGO',
      Location: { lat: -8.83, lng: 13.23 },
      Country_ID: '18decbae-c76f-4b57-b4a3-f564f61b0008', // Portugal, seeded Active=FALSE
    }),
  );

  await expectThrow('createDonation with no activeCountryId (incomplete profile)', () =>
    createDonation('fake-donor-validation-test', null, {
      Item_Type: 'Roupas',
      Quantity: 1,
      Condition: 'Novo',
      Photo: 'https://example.com/fake.jpg',
      Location: { lat: -8.83, lng: 13.23 },
    }),
  );

  console.log('Validation smoke test complete.');
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
