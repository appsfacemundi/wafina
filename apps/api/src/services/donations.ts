import { randomUUID } from 'node:crypto';
import type { Donation, DonationStatus, InstitutionDonationView } from '@wafina/shared';
import { SHEET_TABS } from '../config/sheet-tabs';
import { fromSheetLatLong, nowIso, toSheetLatLong } from '../config/sheet-values';
import { appendRow, findRow, getRows, updateRow } from '../config/sheets';
import { getRegionById } from './geo-regions';
import { createNotification } from './notifications';
import { listUserIdsByCorporateAccount } from './users';
import { ValidationError } from './validation-error';

const MAX_QUANTITY = 10_000;

/**
 * Fixed/hidden value for the current physical-goods-only phase (spec 5.3.2).
 * TODO: confirm this matches whatever literal the live sheet already uses.
 */
const DONATION_TYPE_PHYSICAL_GOODS = 'Bens';

function rowToDonation(row: Record<string, string>): Donation {
  return {
    Donation_ID: row.Donation_ID,
    Public_Donation_Code: row.Public_Donation_Code,
    Donor_ID: row.Donor_ID,
    Donation_Type: row.Donation_Type,
    Item_Type: row.Item_Type,
    Quantity: Number(row.Quantity),
    Condition: row.Condition,
    Photo: row.Photo,
    Location: fromSheetLatLong(row.Location ?? '') ?? { lat: 0, lng: 0 },
    Status: row.Status as DonationStatus,
    Claimed_By_Institution_ID: row.Claimed_By_Institution_ID || null,
    Date_Submitted: row.Date_Submitted,
    Date_Claimed: row.Date_Claimed || null,
    Date_Delivered: row.Date_Delivered || null,
    Country_ID: row.Country_ID,
    City: row.City || null,
  };
}

/**
 * Sequential per-country code (e.g. AO-000125), the only donation identifier
 * ever shown to end users — Donation_ID (the UUID) stays internal. Sheets has
 * no atomic counter, so this reads the current max and increments — the same
 * accepted small-race-window tradeoff already documented on claimDonation,
 * proportionate to V1's expected write volume (not a high-concurrency system).
 */
async function generatePublicDonationCode(countryId: string): Promise<string> {
  const country = await getRegionById(countryId);
  if (!country?.ISO_Code) {
    throw new Error(`Country ${countryId} has no ISO_Code — cannot generate a donation code`);
  }
  const prefix = `${country.ISO_Code}-`;
  const rows = await getRows(SHEET_TABS.donations);
  const maxSeq = rows.reduce((max, row) => {
    const code = row.Public_Donation_Code ?? '';
    if (!code.startsWith(prefix)) return max;
    const num = Number(code.slice(prefix.length));
    return Number.isFinite(num) && num > max ? num : max;
  }, 0);
  return `${prefix}${String(maxSeq + 1).padStart(6, '0')}`;
}

function assertValidLocation(location: { lat: number; lng: number }): void {
  if (
    !Number.isFinite(location?.lat) ||
    !Number.isFinite(location?.lng) ||
    (location.lat === 0 && location.lng === 0)
  ) {
    throw new ValidationError('Location must be a valid, non-zero coordinate pair');
  }
}

function assertValidQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new ValidationError('Quantity must be a positive integer');
  }
  if (quantity > MAX_QUANTITY) {
    throw new ValidationError(`Quantity may not exceed ${MAX_QUANTITY} per submission`);
  }
}

export interface CreateDonationInput {
  Item_Type: string;
  Quantity: number;
  Condition: string;
  Photo: string;
  Location: { lat: number; lng: number };
  /** Free text, optional (e.g. "Luanda") — see the City field comment on the shared Donation type. */
  City?: string;
}

/**
 * Validates everything except Photo. Exported so the route can check these
 * *before* uploading to Drive — otherwise a bad Quantity/Location would leave
 * an orphaned file behind after the donation creation itself fails.
 */
export function assertValidDonationFields(
  input: Omit<CreateDonationInput, 'Photo'>,
): void {
  if (!input.Item_Type) throw new ValidationError('Item_Type is required');
  if (!input.Condition) throw new ValidationError('Condition is required');
  assertValidQuantity(input.Quantity);
  assertValidLocation(input.Location);
}

/**
 * Submission per spec 11.1.1 / 12.1 — Donor_ID always comes from the caller,
 * never the body. Phase 3A Module 1: activeCountryId is likewise always the
 * caller's own session value, never client-supplied — it becomes a permanent
 * snapshot on Country_ID and must never be re-derived later (see the field
 * comment on Donation.Country_ID for why: a donor's Active Country can change
 * after travel, and a past donation must not silently "move" countries with it).
 */
export async function createDonation(
  donorId: string,
  activeCountryId: string | null,
  input: CreateDonationInput,
): Promise<Donation> {
  assertValidDonationFields(input);
  if (!input.Photo) throw new ValidationError('Photo is required');
  if (!activeCountryId) {
    throw new ValidationError('Complete your profile (including country) before donating');
  }

  const row = {
    Donation_ID: randomUUID(),
    Public_Donation_Code: await generatePublicDonationCode(activeCountryId),
    Donor_ID: donorId,
    Donation_Type: DONATION_TYPE_PHYSICAL_GOODS,
    Item_Type: input.Item_Type,
    Quantity: String(input.Quantity),
    Condition: input.Condition,
    Photo: input.Photo,
    Location: toSheetLatLong(input.Location),
    Status: 'Pending',
    Date_Submitted: nowIso(),
    Date_Claimed: '',
    Claimed_By_Institution_ID: '',
    Date_Delivered: '',
    Country_ID: activeCountryId,
    City: input.City?.trim() ?? '',
  };

  await appendRow(SHEET_TABS.donations, row);
  return rowToDonation(row);
}

export async function getDonation(donationId: string): Promise<Donation | null> {
  const row = await findRow(SHEET_TABS.donations, (r) => r.Donation_ID === donationId);
  return row ? rowToDonation(row) : null;
}

export async function listDonationsByDonor(donorId: string): Promise<Donation[]> {
  const rows = await getRows(SHEET_TABS.donations);
  return rows.filter((row) => row.Donor_ID === donorId).map(rowToDonation);
}

/** "Company-wide" donation history for Corporate donors (spec 4.1, 11.4.3). */
export async function listDonationsByCorporateAccount(corporateAccountId: string): Promise<Donation[]> {
  const donorIds = new Set(await listUserIdsByCorporateAccount(corporateAccountId));
  const rows = await getRows(SHEET_TABS.donations);
  return rows.filter((row) => donorIds.has(row.Donor_ID)).map(rowToDonation);
}

/**
 * Institution UX module — resolves a privacy-aware donor identity for a batch
 * of donations in exactly 2 extra Sheets reads total (Users + Corporate_Accounts),
 * regardless of list size. Deliberately batched rather than one lookup per
 * donation: this codebase just had a real production incident from excess
 * Sheets reads (see PROJECT_STATUS.md, 2026-07-30) — an N+1 pattern here would
 * make that worse, not just slow.
 */
async function resolveDonorDisplays(
  donorIds: Iterable<string>,
): Promise<Map<string, { name: string | null; logo: string | null }>> {
  const [userRows, corpRows] = await Promise.all([
    getRows(SHEET_TABS.users),
    getRows(SHEET_TABS.corporateAccounts),
  ]);
  const userById = new Map(userRows.map((u) => [u.User_ID, u]));
  const corpById = new Map(corpRows.map((c) => [c.Corporate_Account_ID, c]));

  const result = new Map<string, { name: string | null; logo: string | null }>();
  for (const donorId of donorIds) {
    const donor = userById.get(donorId);
    if (!donor) {
      result.set(donorId, { name: null, logo: null });
      continue;
    }
    if (donor.Donor_Subtype === 'Corporate' && donor.Corporate_Account_ID) {
      const corp = corpById.get(donor.Corporate_Account_ID);
      if (corp) {
        result.set(donorId, { name: corp.Company_Name || null, logo: corp.Logo || null });
        continue;
      }
    }
    result.set(donorId, {
      name: donor.Show_Name_To_Institutions === 'TRUE' ? donor.Name || null : null,
      logo: null,
    });
  }
  return result;
}

async function toInstitutionDonationViews(
  rows: Record<string, string>[],
): Promise<InstitutionDonationView[]> {
  const displays = await resolveDonorDisplays(new Set(rows.map((r) => r.Donor_ID)));
  return rows.map((row) => {
    const display = displays.get(row.Donor_ID) ?? { name: null, logo: null };
    return {
      ...rowToDonation(row),
      Donor_Display_Name: display.name,
      Donor_Display_Logo: display.logo,
    };
  });
}

/**
 * "Available Donations" browse for verified institutions (spec 9.2). Phase 3A
 * Module 1: scoped to the claiming institution's own operating country
 * (Institutions.Country_ID) — an Angola institution has no reason to see, and
 * shouldn't see, a donation submitted in Portugal. Institution-side scoping
 * uses the institution's Country_ID rather than a personal Active Country,
 * since an institution's operating country is a fixed operational fact, not
 * something the browsing user should toggle.
 */
export async function listAvailableDonations(countryId?: string): Promise<InstitutionDonationView[]> {
  const rows = await getRows(SHEET_TABS.donations);
  const filtered = rows.filter(
    (row) => row.Status === 'Pending' && (!countryId || row.Country_ID === countryId),
  );
  return toInstitutionDonationViews(filtered);
}

/** "Claimed by Me" (spec 9.2) — includes both Claimed and Delivered so history isn't lost. */
export async function listDonationsClaimedByInstitution(
  institutionId: string,
): Promise<InstitutionDonationView[]> {
  const rows = await getRows(SHEET_TABS.donations);
  const filtered = rows.filter((row) => row.Claimed_By_Institution_ID === institutionId);
  return toInstitutionDonationViews(filtered);
}

/** Donor may edit their own donation only while it's still Pending (spec 11.1.2). */
export async function editDonation(
  donorId: string,
  donationId: string,
  patch: Partial<CreateDonationInput>,
): Promise<Donation> {
  const existing = await getDonation(donationId);
  if (!existing) throw new ValidationError('Donation not found');
  if (existing.Donor_ID !== donorId) throw new ValidationError('Not your donation');
  if (existing.Status !== 'Pending') {
    throw new ValidationError('Donation can only be edited while Pending');
  }

  if (patch.Quantity !== undefined) assertValidQuantity(patch.Quantity);
  if (patch.Location !== undefined) assertValidLocation(patch.Location);

  const rowPatch: Record<string, string> = {};
  if (patch.Item_Type !== undefined) rowPatch.Item_Type = patch.Item_Type;
  if (patch.Quantity !== undefined) rowPatch.Quantity = String(patch.Quantity);
  if (patch.Condition !== undefined) rowPatch.Condition = patch.Condition;
  if (patch.Photo !== undefined) rowPatch.Photo = patch.Photo;
  if (patch.Location !== undefined) rowPatch.Location = toSheetLatLong(patch.Location);
  if (patch.City !== undefined) rowPatch.City = patch.City?.trim() ?? '';

  await updateRow(SHEET_TABS.donations, 'Donation_ID', donationId, rowPatch);
  const updated = await getDonation(donationId);
  if (!updated) throw new Error('Donation vanished after update');
  return updated;
}

/**
 * Institution claims a Pending donation. Sheets has no transactions, so this
 * check-then-write has a small race window if two institutions claim at the
 * same instant — accepted as a known V1 limitation given expected launch scale.
 */
export async function claimDonation(institutionId: string, donationId: string): Promise<Donation> {
  const existing = await getDonation(donationId);
  if (!existing) throw new ValidationError('Donation not found');
  if (existing.Status !== 'Pending') throw new ValidationError('Donation is no longer available');

  await updateRow(SHEET_TABS.donations, 'Donation_ID', donationId, {
    Status: 'Claimed',
    Claimed_By_Institution_ID: institutionId,
    Date_Claimed: nowIso(),
  });

  const updated = await getDonation(donationId);
  if (!updated) throw new Error('Donation vanished after claim');

  // Spec 19 — "Donation claimed" notifies the donor, in-app.
  await createNotification({
    recipientUserId: updated.Donor_ID,
    notificationType: 'donation_claimed',
    entityType: 'Donation',
    entityId: updated.Donation_ID,
    message: `A sua doação de ${updated.Item_Type} foi aceite por uma instituição.`,
  });

  return updated;
}

export async function confirmDelivery(institutionId: string, donationId: string): Promise<Donation> {
  const existing = await getDonation(donationId);
  if (!existing) throw new ValidationError('Donation not found');
  if (existing.Status !== 'Claimed') throw new ValidationError('Donation is not in Claimed status');
  if (existing.Claimed_By_Institution_ID !== institutionId) {
    throw new ValidationError('Donation was not claimed by this institution');
  }

  await updateRow(SHEET_TABS.donations, 'Donation_ID', donationId, {
    Status: 'Delivered',
    Date_Delivered: nowIso(),
  });

  const updated = await getDonation(donationId);
  if (!updated) throw new Error('Donation vanished after confirming delivery');

  // Spec 19 — "Donation delivered" notifies the donor, in-app.
  await createNotification({
    recipientUserId: updated.Donor_ID,
    notificationType: 'donation_delivered',
    entityType: 'Donation',
    entityId: updated.Donation_ID,
    message: `A sua doação de ${updated.Item_Type} foi entregue.`,
  });

  return updated;
}

/** Backs Institutions.Total_Items_Received, which is a calculated field, not a stored column. */
export async function sumDeliveredQuantityForInstitution(institutionId: string): Promise<number> {
  const rows = await getRows(SHEET_TABS.donations);
  return rows
    .filter((row) => row.Claimed_By_Institution_ID === institutionId && row.Status === 'Delivered')
    .reduce((total, row) => total + (Number(row.Quantity) || 0), 0);
}
