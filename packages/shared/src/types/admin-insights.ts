import type { DonationStatus } from '../enums/donation-status';

/**
 * Admin Insights module, 2026-08-08 — launch-readiness dashboard for
 * presenting Wafina's reach to institutions/partners. One aggregated payload
 * (donations, institutions, donors, all keyed by country + individually
 * geo-pointed) rather than several round trips, since the whole dashboard
 * renders from this single call.
 */
export interface AdminInsightsCountryStat {
  Country_ID: string;
  Name: string;
  ISO_Code: string | null;
  donations: number;
  itemsDonated: number;
  donationsPending: number;
  donationsClaimed: number;
  donationsDelivered: number;
  institutions: number;
  institutionsVerified: number;
  donors: number;
}

export interface AdminInsightsMapPoint {
  lat: number;
  lng: number;
  kind: 'donation' | 'institution';
  status: DonationStatus | null;
  verified: boolean | null;
  label: string;
  Country_ID: string;
}

export interface AdminInsightsTrendPoint {
  date: string;
  donations: number;
}

export interface AdminInsightsStatusCount {
  status: DonationStatus;
  count: number;
}

export interface AdminInsights {
  kpis: {
    totalDonations: number;
    totalItemsDonated: number;
    totalInstitutions: number;
    verifiedInstitutions: number;
    totalDonors: number;
    corporateAccounts: number;
    totalDelivered: number;
    activeCountries: number;
  };
  byCountry: AdminInsightsCountryStat[];
  mapPoints: AdminInsightsMapPoint[];
  donationsOverTime: AdminInsightsTrendPoint[];
  statusBreakdown: AdminInsightsStatusCount[];
  donorTypeBreakdown: { individual: number; corporate: number };
}
