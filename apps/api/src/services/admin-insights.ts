import { DONATION_STATUSES } from '@wafina/shared';
import type { AdminInsights, AdminInsightsCountryStat, AdminInsightsMapPoint } from '@wafina/shared';
import { listAllCorporateAccounts } from './corporate-accounts';
import { listAllDonationsForAdmin } from './donations';
import { listAllCountries } from './geo-regions';
import { listAllInstitutions } from './institutions';
import { listAllUsers } from './users';

const TREND_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Admin Insights module, 2026-08-08 — one aggregated read across
 * donations/institutions/users/corporate accounts, all bucketed by country
 * plus individually geo-pointed for the map. Everything here is derived from
 * data that already exists (no new Sheets columns) — this just reshapes it
 * for presentation. Relies on getRows' short TTL cache (config/sheets.ts) so
 * repeated dashboard loads/filter changes don't hammer the Sheets API.
 */
export async function getAdminInsights(): Promise<AdminInsights> {
  const [countries, donations, institutions, users, corporateAccounts] = await Promise.all([
    listAllCountries(),
    listAllDonationsForAdmin(),
    listAllInstitutions(),
    listAllUsers(),
    listAllCorporateAccounts(),
  ]);

  const countryById = new Map(countries.map((c) => [c.Region_ID, c]));
  const byCountryMap = new Map<string, AdminInsightsCountryStat>();

  function bucket(countryId: string): AdminInsightsCountryStat {
    let entry = byCountryMap.get(countryId);
    if (!entry) {
      const country = countryById.get(countryId);
      entry = {
        Country_ID: countryId,
        Name: country?.Name ?? 'Desconhecido',
        ISO_Code: country?.ISO_Code ?? null,
        donations: 0,
        itemsDonated: 0,
        donationsPending: 0,
        donationsClaimed: 0,
        donationsDelivered: 0,
        institutions: 0,
        institutionsVerified: 0,
        donors: 0,
      };
      byCountryMap.set(countryId, entry);
    }
    return entry;
  }

  for (const d of donations) {
    if (!d.Country_ID) continue;
    const b = bucket(d.Country_ID);
    b.donations += 1;
    if (Number.isSafeInteger(d.Quantity)) b.itemsDonated += d.Quantity;
    if (d.Status === 'Pending') b.donationsPending += 1;
    else if (d.Status === 'Delivered') b.donationsDelivered += 1;
    else b.donationsClaimed += 1;
  }

  for (const inst of institutions) {
    if (!inst.Country_ID) continue;
    const b = bucket(inst.Country_ID);
    b.institutions += 1;
    if (inst.Verified) b.institutionsVerified += 1;
  }

  const donors = users.filter((u) => u.Role === 'Donor');
  for (const donor of donors) {
    if (donor.Active_Country_ID) bucket(donor.Active_Country_ID).donors += 1;
  }

  const mapPoints: AdminInsightsMapPoint[] = [
    ...donations
      .filter((d) => Number.isFinite(d.Location?.lat) && Number.isFinite(d.Location?.lng))
      .map((d) => ({
        lat: d.Location.lat,
        lng: d.Location.lng,
        kind: 'donation' as const,
        status: d.Status,
        verified: null,
        label: `${d.Item_Type} · ${d.Public_Donation_Code}`,
        Country_ID: d.Country_ID,
      })),
    ...institutions
      .filter((i) => Number.isFinite(i.Location?.lat) && Number.isFinite(i.Location?.lng))
      .map((i) => ({
        lat: i.Location.lat,
        lng: i.Location.lng,
        kind: 'institution' as const,
        status: null,
        verified: i.Verified,
        label: i.Name,
        Country_ID: i.Country_ID,
      })),
  ];

  const trendMap = new Map<string, number>();
  const now = Date.now();
  for (const d of donations) {
    const t = Date.parse(d.Date_Submitted);
    if (Number.isNaN(t) || now - t > TREND_WINDOW_MS) continue;
    const day = d.Date_Submitted.slice(0, 10);
    trendMap.set(day, (trendMap.get(day) ?? 0) + 1);
  }
  const donationsOverTime = Array.from(trendMap.entries())
    .map(([date, count]) => ({ date, donations: count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const statusBreakdown = DONATION_STATUSES.map((status) => ({
    status,
    count: donations.filter((d) => d.Status === status).length,
  }));

  const donorTypeBreakdown = {
    individual: donors.filter((d) => d.Donor_Subtype === 'Individual').length,
    corporate: donors.filter((d) => d.Donor_Subtype === 'Corporate').length,
  };

  return {
    kpis: {
      totalDonations: donations.length,
      totalItemsDonated: donations.reduce((sum, d) => sum + (Number.isSafeInteger(d.Quantity) ? d.Quantity : 0), 0),
      totalInstitutions: institutions.length,
      verifiedInstitutions: institutions.filter((i) => i.Verified).length,
      totalDonors: donors.length,
      corporateAccounts: corporateAccounts.length,
      totalDelivered: donations.filter((d) => d.Status === 'Delivered').length,
      activeCountries: countries.filter((c) => c.Active).length,
    },
    byCountry: Array.from(byCountryMap.values()).sort((a, b) => b.donations - a.donations),
    mapPoints,
    donationsOverTime,
    statusBreakdown,
    donorTypeBreakdown,
  };
}
