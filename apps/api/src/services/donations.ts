import { randomUUID } from 'node:crypto';
import type { AdminDonationView, Donation, DonationStatus, InstitutionDonationView } from '@wafina/shared';
import { SHEET_TABS } from '../config/sheet-tabs';
import { fromSheetLatLong, nowIso, toSheetLatLong } from '../config/sheet-values';
import { appendRow, findRow, getRows, updateRow } from '../config/sheets';
import { getRegionById } from './geo-regions';
import { createNotification } from './notifications';
import { ValidationError } from './validation-error';

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
    Date_Collection_Scheduled: row.Date_Collection_Scheduled || null,
    Date_Collected: row.Date_Collected || null,
    Date_Delivered: row.Date_Delivered || null,
    Country_ID: row.Country_ID,
    City: row.City || null,
    Expected_Collection_Date: row.Expected_Collection_Date || null,
    Expected_Delivery_Date: row.Expected_Delivery_Date || null,
    Corporate_Account_ID: row.Corporate_Account_ID || null,
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
    throw new ValidationError('A localização deve ser um par de coordenadas válido e diferente de zero');
  }
}

/**
 * Stabilization module (2026-07-31) — the previous 10,000-unit cap was an
 * arbitrary number with no real business rule behind it (a corporate donor
 * legitimately donating, say, 20,000 school notebooks should never be
 * blocked by the platform). Only genuine constraints remain: a donation
 * quantity must be a real, positive whole number.
 */
function assertValidQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new ValidationError('A quantidade deve ser um número inteiro positivo');
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
  if (!input.Item_Type) throw new ValidationError('O tipo de item é obrigatório');
  if (!input.Condition) throw new ValidationError('O estado é obrigatório');
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
  /**
   * RC1 individual-vs-corporate attribution — always the caller's own
   * session `corporateAccountId` when they chose "Corporate Donation", or
   * null for a personal one. Never client-supplied as an arbitrary ID (see
   * the route), so a donor can only ever attribute a donation to the single
   * company they're actually linked to, exactly like donorId/activeCountryId.
   */
  corporateAccountId: string | null = null,
): Promise<Donation> {
  assertValidDonationFields(input);
  if (!input.Photo) throw new ValidationError('A fotografia é obrigatória');
  if (!activeCountryId) {
    throw new ValidationError('Complete o seu perfil (incluindo o país) antes de doar');
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
    Date_Collection_Scheduled: '',
    Date_Collected: '',
    Date_Delivered: '',
    Country_ID: activeCountryId,
    City: input.City?.trim() ?? '',
    Expected_Collection_Date: '',
    Expected_Delivery_Date: '',
    Corporate_Account_ID: corporateAccountId ?? '',
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
  // Real-device finding, 2026-08-04/05 — this was logged in the very first
  // batch (matching every sibling list function) but missed in the big
  // implementation sweep; only the Institution equivalent got fixed then.
  return rows
    .filter((row) => row.Donor_ID === donorId)
    .sort((a, b) => (b.Date_Submitted || '').localeCompare(a.Date_Submitted || ''))
    .map(rowToDonation);
}

/**
 * Corporate reporting (Admin's company view) — RC1: a donation only counts
 * for a company if the donor explicitly chose "Corporate Donation" for it,
 * not merely because the donor happens to be linked to that company (see
 * Donation.Corporate_Account_ID). A direct filter, no donor-ID join needed.
 */
export async function listDonationsByCorporateAccount(corporateAccountId: string): Promise<Donation[]> {
  const rows = await getRows(SHEET_TABS.donations);
  return rows.filter((row) => row.Corporate_Account_ID === corporateAccountId).map(rowToDonation);
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
  // Real-device finding, 2026-08-04: unsorted, same missing-sort pattern as
  // listDonationsByDonor — newest-claimed first, matching every sibling list.
  const filtered = rows
    .filter((row) => row.Claimed_By_Institution_ID === institutionId)
    .sort((a, b) => (b.Date_Claimed || '').localeCompare(a.Date_Claimed || ''));
  return toInstitutionDonationViews(filtered);
}

/**
 * Admin Web App — every donation past Pending (Claimed onward), across all
 * institutions/countries, so Admin can set Expected_Collection_Date /
 * Expected_Delivery_Date with visibility into who's handling each one.
 * Newest-claimed first, since those are the ones most likely to need a fresh
 * estimate.
 */
export async function listInFlightDonationsForAdmin(): Promise<AdminDonationView[]> {
  const rows = await getRows(SHEET_TABS.donations);
  const filtered = rows
    .filter((row) => row.Status !== 'Pending')
    .sort((a, b) => (b.Date_Claimed || '').localeCompare(a.Date_Claimed || ''));

  const views = await toInstitutionDonationViews(filtered);
  const institutionRows = await getRows(SHEET_TABS.institutions);
  const institutionById = new Map(institutionRows.map((r) => [r.Institution_ID, r]));

  return views.map((view) => {
    const institution = view.Claimed_By_Institution_ID
      ? institutionById.get(view.Claimed_By_Institution_ID)
      : undefined;
    return {
      ...view,
      Claimed_By_Institution_Name: institution?.Name || null,
      Claimed_By_Institution_Logo: institution?.Logo || null,
    };
  });
}

/**
 * Production Readiness Report follow-up (2026-07-31) — `listInFlightDonationsForAdmin`
 * deliberately excludes Pending donations (it backs the logistics page, where
 * setting a collection/delivery estimate makes no sense before an institution
 * has claimed the donation). That left Admin with genuinely zero visibility
 * into a donation between submission and claim — nowhere in the Admin app
 * could a brand-new, not-yet-claimed donation be seen at all, contradicting
 * the explicit "view every donation" requirement. This is the unfiltered
 * counterpart, for Reports specifically, where the job is comprehensive
 * visibility rather than a logistics action.
 */
export async function listAllDonationsForAdmin(): Promise<AdminDonationView[]> {
  const rows = await getRows(SHEET_TABS.donations);
  const sorted = [...rows].sort((a, b) => (b.Date_Submitted || '').localeCompare(a.Date_Submitted || ''));

  const views = await toInstitutionDonationViews(sorted);
  const institutionRows = await getRows(SHEET_TABS.institutions);
  const institutionById = new Map(institutionRows.map((r) => [r.Institution_ID, r]));

  return views.map((view) => {
    const institution = view.Claimed_By_Institution_ID
      ? institutionById.get(view.Claimed_By_Institution_ID)
      : undefined;
    return {
      ...view,
      Claimed_By_Institution_Name: institution?.Name || null,
      Claimed_By_Institution_Logo: institution?.Logo || null,
    };
  });
}

/**
 * Dashboard stat — count only, no view enrichment (Users/Corporate_Accounts/Institutions
 * reads), since `listAllDonationsForAdmin` does that enrichment for display purposes the
 * stat tile doesn't need.
 *
 * Real-device finding, 2026-08-04: a single mixed total across every country
 * made it impossible to tell at a glance where pending donations actually are
 * — byCountry gives the dashboard a per-country breakdown alongside the total.
 */
export async function countPendingDonations(): Promise<{ total: number; byCountry: Record<string, number> }> {
  const rows = await getRows(SHEET_TABS.donations);
  const pending = rows.filter((row) => row.Status === 'Pending');
  const byCountry: Record<string, number> = {};
  for (const row of pending) {
    byCountry[row.Country_ID] = (byCountry[row.Country_ID] ?? 0) + 1;
  }
  return { total: pending.length, byCountry };
}

/** Donor may edit their own donation only while it's still Pending (spec 11.1.2). */
export async function editDonation(
  donorId: string,
  donationId: string,
  patch: Partial<CreateDonationInput>,
): Promise<Donation> {
  const existing = await getDonation(donationId);
  if (!existing) throw new ValidationError('Doação não encontrada');
  if (existing.Donor_ID !== donorId) throw new ValidationError('Esta doação não é sua');
  if (existing.Status !== 'Pending') {
    throw new ValidationError('A doação só pode ser editada enquanto estiver Pendente');
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
  if (!existing) throw new ValidationError('Doação não encontrada');
  if (existing.Status !== 'Pending') throw new ValidationError('A doação já não está disponível');

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

/**
 * Institution App Polish module — the institution marks that it has arranged
 * a collection time/logistics with the donor. Purely a physical-progress
 * marker; it does not set or require Expected_Collection_Date (that's
 * Admin's separate estimate — see setExpectedDates).
 */
export async function scheduleCollection(institutionId: string, donationId: string): Promise<Donation> {
  const existing = await getDonation(donationId);
  if (!existing) throw new ValidationError('Doação não encontrada');
  if (existing.Status !== 'Claimed') throw new ValidationError('A doação não está no estado Aceite');
  if (existing.Claimed_By_Institution_ID !== institutionId) {
    throw new ValidationError('Esta doação não foi aceite por esta instituição');
  }

  await updateRow(SHEET_TABS.donations, 'Donation_ID', donationId, {
    Status: 'Collection_Scheduled',
    Date_Collection_Scheduled: nowIso(),
  });

  const updated = await getDonation(donationId);
  if (!updated) throw new Error('Donation vanished after scheduling collection');
  return updated;
}

/** Institution marks the item as physically collected from the donor. */
export async function markCollected(institutionId: string, donationId: string): Promise<Donation> {
  const existing = await getDonation(donationId);
  if (!existing) throw new ValidationError('Doação não encontrada');
  if (existing.Status !== 'Collection_Scheduled') {
    throw new ValidationError('A doação não está no estado Recolha Agendada');
  }
  if (existing.Claimed_By_Institution_ID !== institutionId) {
    throw new ValidationError('Esta doação não foi aceite por esta instituição');
  }

  await updateRow(SHEET_TABS.donations, 'Donation_ID', donationId, {
    Status: 'Collected',
    Date_Collected: nowIso(),
  });

  const updated = await getDonation(donationId);
  if (!updated) throw new Error('Donation vanished after marking collected');
  return updated;
}

export async function confirmDelivery(institutionId: string, donationId: string): Promise<Donation> {
  const existing = await getDonation(donationId);
  if (!existing) throw new ValidationError('Doação não encontrada');
  if (existing.Status !== 'Collected') throw new ValidationError('A doação não está no estado Recolhida');
  if (existing.Claimed_By_Institution_ID !== institutionId) {
    throw new ValidationError('Esta doação não foi aceite por esta instituição');
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

/**
 * Admin Web App — sets/updates the informational delivery estimate. Either
 * date may be set independently. If a date that was already set changes,
 * both the donor and the claiming institution are notified — per the
 * stakeholder's explicit requirement that a changed estimate notify both
 * parties, not just silently update.
 */
export async function setExpectedDates(
  donationId: string,
  dates: { expectedCollectionDate?: string; expectedDeliveryDate?: string },
): Promise<Donation> {
  const existing = await getDonation(donationId);
  if (!existing) throw new ValidationError('Doação não encontrada');

  const patch: Record<string, string> = {};
  const changes: string[] = [];

  if (dates.expectedCollectionDate !== undefined) {
    const isChange =
      existing.Expected_Collection_Date && existing.Expected_Collection_Date !== dates.expectedCollectionDate;
    if (isChange) changes.push('a data de recolha estimada');
    patch.Expected_Collection_Date = dates.expectedCollectionDate;
  }
  if (dates.expectedDeliveryDate !== undefined) {
    const isChange =
      existing.Expected_Delivery_Date && existing.Expected_Delivery_Date !== dates.expectedDeliveryDate;
    if (isChange) changes.push('a data de entrega estimada');
    patch.Expected_Delivery_Date = dates.expectedDeliveryDate;
  }

  await updateRow(SHEET_TABS.donations, 'Donation_ID', donationId, patch);
  const updated = await getDonation(donationId);
  if (!updated) throw new Error('Donation vanished after setting expected dates');

  if (changes.length > 0) {
    const message = `A estimativa da sua doação de ${updated.Item_Type} foi atualizada: ${changes.join(' e ')} mudou.`;
    await createNotification({
      recipientUserId: updated.Donor_ID,
      notificationType: 'donation_delivered',
      entityType: 'Donation',
      entityId: updated.Donation_ID,
      message,
    });
    if (updated.Claimed_By_Institution_ID) {
      const institutionUser = await findRow(
        SHEET_TABS.institutions,
        (r) => r.Institution_ID === updated.Claimed_By_Institution_ID,
      );
      if (institutionUser?.User_ID) {
        await createNotification({
          recipientUserId: institutionUser.User_ID,
          notificationType: 'donation_delivered',
          entityType: 'Donation',
          entityId: updated.Donation_ID,
          message,
        });
      }
    }
  }

  return updated;
}

/** Backs Institutions.Total_Items_Received, which is a calculated field, not a stored column. */
export async function sumDeliveredQuantityForInstitution(institutionId: string): Promise<number> {
  const rows = await getRows(SHEET_TABS.donations);
  return rows
    .filter((row) => row.Claimed_By_Institution_ID === institutionId && row.Status === 'Delivered')
    .reduce((total, row) => total + (Number(row.Quantity) || 0), 0);
}
