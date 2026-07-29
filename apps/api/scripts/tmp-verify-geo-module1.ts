import { SHEET_TABS } from '../src/config/sheet-tabs';
import { getRows } from '../src/config/sheets';

async function main() {
  const regions = await getRows(SHEET_TABS.geoRegions);
  console.log('=== Geo_Regions ===');
  console.table(regions.map((r) => ({ Name: r.Name, Level: r.Level, ISO: r.ISO_Code, Active: r.Active })));

  const users = await getRows(SHEET_TABS.users);
  console.log('=== Users (country fields) ===');
  console.table(
    users.map((u) => ({
      User_ID: u.User_ID.slice(0, 8),
      Home: u.Home_Country_ID ? 'set' : 'MISSING',
      Active: u.Active_Country_ID ? 'set' : 'MISSING',
      Pref: u.Switch_Preference,
    })),
  );

  const institutions = await getRows(SHEET_TABS.institutions);
  console.log('=== Institutions (country fields) ===');
  console.table(
    institutions.map((i) => ({
      Institution_ID: i.Institution_ID.slice(0, 8),
      Country_ID: i.Country_ID ? 'set' : 'MISSING',
    })),
  );

  const donations = await getRows(SHEET_TABS.donations);
  const missingDonationCountry = donations.filter((d) => !d.Country_ID?.trim());
  console.log('Donations missing Country_ID:', missingDonationCountry.length, 'of', donations.length);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
