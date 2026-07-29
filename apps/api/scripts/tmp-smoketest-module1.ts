import { isActiveCountry, listActiveCountries } from '../src/services/geo-regions';
import { listVerifiedInstitutions } from '../src/services/institutions';
import { listAvailableDonations } from '../src/services/donations';

async function main() {
  const countries = await listActiveCountries();
  console.log('Active countries (should be Angola only):', countries.map((c) => c.Name));
  const angola = countries.find((c) => c.ISO_Code === 'AO')!;

  console.log('isActiveCountry(Angola):', await isActiveCountry(angola.Region_ID));
  console.log('isActiveCountry(bogus-id):', await isActiveCountry('bogus-id'));

  const instAngola = await listVerifiedInstitutions(angola.Region_ID);
  console.log('Verified institutions in Angola:', instAngola.length);

  const instNoFilter = await listVerifiedInstitutions();
  console.log('Verified institutions, no filter:', instNoFilter.length);

  // Fake, non-existent country ID — should return zero results, proving the filter works.
  const instFake = await listVerifiedInstitutions('00000000-0000-0000-0000-000000000000');
  console.log('Verified institutions in a fake country (should be 0):', instFake.length);

  const donationsAngola = await listAvailableDonations(angola.Region_ID);
  console.log('Available (Pending) donations in Angola:', donationsAngola.length);

  const donationsFake = await listAvailableDonations('00000000-0000-0000-0000-000000000000');
  console.log('Available donations in a fake country (should be 0):', donationsFake.length);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
