import { randomUUID } from 'node:crypto';
import { DELIVERY_METHOD_LABEL, DELIVERY_METHODS, RECIPIENT_CATEGORIES } from '@wafina/shared';
import type {
  AdminDonationView,
  DeliveryMethod,
  Donation,
  DonationApprovalStatus,
  DonationStatus,
  IndividualDonationState,
  InstitutionDonationView,
  ReceberEligibility,
  RecipientCategory,
  SuccessStoryStatus,
} from '@wafina/shared';
import { toProxiedUrl } from '../config/photo-storage';
import { SHEET_TABS } from '../config/sheet-tabs';
import { fromSheetLatLong, nowIso, parseSheetDate, sequenceSuffix, toSheetLatLong } from '../config/sheet-values';
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
    Recipient_Category: (row.Recipient_Category || null) as RecipientCategory | null,
    Delivery_Method: (row.Delivery_Method || null) as DeliveryMethod | null,
    Photo: toProxiedUrl(row.Photo) ?? '',
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
    Address: row.Address || null,
    Expected_Collection_Date: row.Expected_Collection_Date || null,
    Expected_Delivery_Date: row.Expected_Delivery_Date || null,
    Corporate_Account_ID: row.Corporate_Account_ID || null,
    // RC1 RECEBER — blank means this row predates the approval gate; treated
    // as 'Approved' so every already-in-flight donation keeps working exactly
    // as it did before this shipped (see the field comment on the shared type).
    Approval_Status: (row.Approval_Status || 'Approved') as DonationApprovalStatus,
    Approval_Rejection_Reason: row.Approval_Rejection_Reason || null,
    Reserved_By_User_ID: row.Reserved_By_User_ID || null,
    Reserved_At: row.Reserved_At || null,
    Individual_Delivered_At: row.Individual_Delivered_At || null,
  };
}

/** RC1 RECEBER — a reservation older than this is treated as expired and released back to available. */
const RESERVATION_WINDOW_MS = 24 * 60 * 60 * 1000;

function isReservationActive(row: { Reserved_By_User_ID?: string | null; Reserved_At?: string | null }): boolean {
  if (!row.Reserved_By_User_ID || !row.Reserved_At) return false;
  return Date.now() - new Date(row.Reserved_At).getTime() < RESERVATION_WINDOW_MS;
}

/**
 * RC1 RECEBER — the single predicate every recipient-facing list (Institution,
 * Animal Shelter, individual RECEBER) filters through: Admin must have
 * approved it, it must still be Pending (not already claimed/reserved away),
 * and it must be intended for the caller's own recipient category. Operates
 * on raw sheet rows (same blank-defaults-to-Approved rule as rowToDonation)
 * so callers can filter before paying for the full row->Donation conversion.
 * Kept as one function so a future change to the approval rule can't drift
 * between the three callers.
 */
function isVisibleForRecipients(row: Record<string, string>, category: RecipientCategory): boolean {
  const approvalStatus = row.Approval_Status || 'Approved';
  return row.Status === 'Pending' && approvalStatus === 'Approved' && row.Recipient_Category === category;
}

/** RC1 RECEBER — Admin-facing computed state for People-category donations only; see the shared enum's doc comment. */
function computeIndividualState(row: Donation): IndividualDonationState | null {
  if (row.Recipient_Category !== 'People') return null;
  if (row.Status === 'Delivered') return 'Delivered';
  if (isReservationActive(row)) return 'Reserved';
  return 'Available';
}

/**
 * RC1 RECEBER — a confirmed receipt makes a Pessoa ineligible to reserve
 * again for this long. Starts from Individual_Delivered_At (set only by
 * confirmIndividualPickup), never from Reserved_At — an expired or cancelled
 * reservation never sets that field, so it can't trigger this window.
 * Changed from 30 to 3 days, 2026-08-10 (product decision).
 */
const RECEBER_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Scans Donations directly rather than adding a Users-sheet column — a
 * confirmed individual receipt is already fully recorded here
 * (Reserved_By_User_ID + Status='Delivered' + Individual_Delivered_At), so a
 * second source of truth would only risk drifting out of sync with it.
 */
async function getActiveReservationForUser(userId: string): Promise<Donation | null> {
  const rows = await getRows(SHEET_TABS.donations);
  const active = rows.find(
    (row) => row.Reserved_By_User_ID === userId && row.Status === 'Pending' && isReservationActive(row),
  );
  return active ? rowToDonation(active) : null;
}

/** Most recent confirmed-receipt timestamp for this Pessoa, or null if they've never confirmed one. */
async function getLastReceberReceiptAt(userId: string): Promise<Date | null> {
  const rows = await getRows(SHEET_TABS.donations);
  const receipts = rows
    .filter(
      (row) =>
        row.Reserved_By_User_ID === userId && row.Status === 'Delivered' && row.Recipient_Category === 'People',
    )
    .map((row) => new Date(row.Individual_Delivered_At || 0).getTime())
    .filter((t) => Number.isFinite(t) && t > 0);
  if (receipts.length === 0) return null;
  return new Date(Math.max(...receipts));
}

/**
 * RC1 RECEBER — the single authority both reserveDonationForIndividual (write
 * path) and GET /donations/receber-status (read path, what the app checks
 * before ever showing the swipe stack) call, so the two can't drift apart.
 * Order matters: an active reservation is checked first since it's the more
 * specific, currently-actionable state (resume pickup) — the cooldown only
 * applies once there's no reservation in flight.
 */
export async function checkReceberEligibility(userId: string): Promise<ReceberEligibility> {
  const activeReservation = await getActiveReservationForUser(userId);
  if (activeReservation) {
    return { eligible: false, reason: 'active_reservation', activeReservation, nextEligibleAt: null };
  }

  const lastReceiptAt = await getLastReceberReceiptAt(userId);
  if (lastReceiptAt) {
    const eligibleAgainAt = lastReceiptAt.getTime() + RECEBER_COOLDOWN_MS;
    if (Date.now() < eligibleAgainAt) {
      return {
        eligible: false,
        reason: 'cooldown',
        activeReservation: null,
        nextEligibleAt: new Date(eligibleAgainAt).toISOString(),
      };
    }
  }

  return { eligible: true, reason: null, activeReservation: null, nextEligibleAt: null };
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
 *
 * Real-device finding, 2026-08-07 — the mobile/web quantity field has no
 * upper bound on typed input, and a stray keystroke produced a donation with
 * Quantity ~1.1e23. Number.isInteger() doesn't catch this (large-enough
 * floats have no fractional part), so this isn't a business cap making a
 * comeback — it's a data-integrity ceiling generous enough to never affect a
 * real donation (100x the old, already-too-strict 10,000 cap) while
 * rejecting obvious garbage.
 */
const MAX_PLAUSIBLE_QUANTITY = 1_000_000;

function assertValidQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > MAX_PLAUSIBLE_QUANTITY) {
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
  /** Optional — see the Address field comment on the shared Donation type. */
  Address?: string;
  /** Epic 0.6, 2026-08-06 — required, fixed set. */
  Recipient_Category: RecipientCategory;
  /** Epic 0.6, 2026-08-06 — required, fixed set. */
  Delivery_Method: DeliveryMethod;
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
  if (!RECIPIENT_CATEGORIES.includes(input.Recipient_Category)) {
    throw new ValidationError('É necessário indicar a categoria do destinatário');
  }
  if (!DELIVERY_METHODS.includes(input.Delivery_Method)) {
    throw new ValidationError('É necessário indicar o método de entrega');
  }
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
    Recipient_Category: input.Recipient_Category,
    Delivery_Method: input.Delivery_Method,
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
    Address: input.Address?.trim() ?? '',
    Expected_Collection_Date: '',
    Expected_Delivery_Date: '',
    Corporate_Account_ID: corporateAccountId ?? '',
    // RC1 RECEBER — every new donation now needs explicit Admin approval
    // before it's visible to any recipient channel (see isVisibleForRecipients).
    Approval_Status: 'Pending_Review',
    Approval_Rejection_Reason: '',
    Reserved_By_User_ID: '',
    Reserved_At: '',
    Individual_Delivered_At: '',
  };

  await appendRow(SHEET_TABS.donations, row);
  return rowToDonation(row);
}

export async function getDonation(donationId: string): Promise<Donation | null> {
  const row = await findRow(SHEET_TABS.donations, (r) => r.Donation_ID === donationId);
  return row ? rowToDonation(row) : null;
}

async function getDonationOrThrow(donationId: string): Promise<Donation> {
  const donation = await getDonation(donationId);
  if (!donation) throw new ValidationError('Doação não encontrada');
  return donation;
}

/**
 * RC1 RECEBER — Admin's new quality gate. Mirrors approveSuccessStory's
 * pattern exactly (status guard, updateRow, notify the donor) — see
 * success-stories.ts. This is the moment a donation becomes visible to any
 * recipient channel via isVisibleForRecipients.
 */
export async function approveDonation(donationId: string): Promise<Donation> {
  const existing = await getDonationOrThrow(donationId);
  if (existing.Approval_Status !== 'Pending_Review') {
    throw new ValidationError('Só é possível aprovar uma doação pendente de revisão');
  }

  await updateRow(SHEET_TABS.donations, 'Donation_ID', donationId, {
    Approval_Status: 'Approved',
    Approval_Rejection_Reason: '',
  });
  const updated = await getDonationOrThrow(donationId);

  await createNotification({
    recipientUserId: updated.Donor_ID,
    notificationType: 'donation_approved',
    entityType: 'Donation',
    entityId: updated.Donation_ID,
    message: `A sua doação de ${updated.Item_Type} foi aprovada e já está visível para receção.`,
  });

  return updated;
}

/** RC1 RECEBER — Admin rejects outright; the donor is notified with the reason. */
export async function rejectDonation(donationId: string, reason: string): Promise<Donation> {
  if (!reason || !reason.trim()) throw new ValidationError('O motivo de rejeição é obrigatório');

  const existing = await getDonationOrThrow(donationId);
  if (existing.Approval_Status !== 'Pending_Review') {
    throw new ValidationError('Só é possível rejeitar uma doação pendente de revisão');
  }

  await updateRow(SHEET_TABS.donations, 'Donation_ID', donationId, {
    Approval_Status: 'Rejected',
    Approval_Rejection_Reason: reason.trim(),
  });
  const updated = await getDonationOrThrow(donationId);

  await createNotification({
    recipientUserId: updated.Donor_ID,
    notificationType: 'donation_rejected',
    entityType: 'Donation',
    entityId: updated.Donation_ID,
    message: `A sua doação de ${updated.Item_Type} foi rejeitada. Motivo: ${reason.trim()}`,
  });

  return updated;
}

/**
 * RC1 RECEBER — Admin asks the donor to fix something instead of an outright
 * rejection. Reuses the same Rejected+reason shape as rejectDonation (so the
 * donor sees exactly what to fix), but the donor can act on it: editDonation
 * (still available while Status stays 'Pending') followed by resubmitDonation
 * puts it back in the review queue. Mirrors the Institution resubmission
 * precedent in institutions.ts.
 */
export async function requestDonationCorrection(donationId: string, reason: string): Promise<Donation> {
  if (!reason || !reason.trim()) throw new ValidationError('O motivo é obrigatório');

  const existing = await getDonationOrThrow(donationId);
  if (existing.Approval_Status !== 'Pending_Review') {
    throw new ValidationError('Só é possível pedir correção a uma doação pendente de revisão');
  }

  await updateRow(SHEET_TABS.donations, 'Donation_ID', donationId, {
    Approval_Status: 'Rejected',
    Approval_Rejection_Reason: reason.trim(),
  });
  const updated = await getDonationOrThrow(donationId);

  await createNotification({
    recipientUserId: updated.Donor_ID,
    notificationType: 'donation_correction_requested',
    entityType: 'Donation',
    entityId: updated.Donation_ID,
    message: `A sua doação de ${updated.Item_Type} precisa de uma correção antes de ser aprovada: ${reason.trim()}`,
  });

  return updated;
}

/** RC1 RECEBER — donor resubmits after a rejection/correction request, sending it back to the review queue. */
export async function resubmitDonation(donorId: string, donationId: string): Promise<Donation> {
  const existing = await getDonationOrThrow(donationId);
  if (existing.Donor_ID !== donorId) throw new ValidationError('Esta doação não é sua');
  if (existing.Approval_Status !== 'Rejected') {
    throw new ValidationError('Só é possível reenviar uma doação rejeitada');
  }

  await updateRow(SHEET_TABS.donations, 'Donation_ID', donationId, {
    Approval_Status: 'Pending_Review',
    Approval_Rejection_Reason: '',
  });
  return getDonationOrThrow(donationId);
}

/** RC1 RECEBER — Admin pulls an inappropriate individual donation out of RECEBER; also releases any active reservation. */
export async function removeIndividualDonation(donationId: string, reason: string): Promise<Donation> {
  if (!reason || !reason.trim()) throw new ValidationError('O motivo é obrigatório');

  const existing = await getDonationOrThrow(donationId);
  if (existing.Recipient_Category !== 'People') {
    throw new ValidationError('Esta ação só se aplica a doações destinadas a Pessoas');
  }

  await updateRow(SHEET_TABS.donations, 'Donation_ID', donationId, {
    Approval_Status: 'Rejected',
    Approval_Rejection_Reason: reason.trim(),
    Reserved_By_User_ID: '',
    Reserved_At: '',
  });
  const updated = await getDonationOrThrow(donationId);

  await createNotification({
    recipientUserId: updated.Donor_ID,
    notificationType: 'donation_rejected',
    entityType: 'Donation',
    entityId: updated.Donation_ID,
    message: `A sua doação de ${updated.Item_Type} foi removida do Receber. Motivo: ${reason.trim()}`,
  });

  return updated;
}

/** RC1 RECEBER — Admin's review queue: every donation still awaiting Approve/Reject. */
export async function listPendingReviewDonations(): Promise<AdminDonationView[]> {
  const rows = await getRows(SHEET_TABS.donations);
  const filtered = rows
    .filter((row) => (row.Approval_Status || 'Approved') === 'Pending_Review')
    .sort((a, b) => parseSheetDate(a.Date_Submitted) - parseSheetDate(b.Date_Submitted));
  return toAdminDonationViews(filtered);
}

export async function listDonationsByDonor(donorId: string): Promise<Donation[]> {
  const rows = await getRows(SHEET_TABS.donations);
  // Real-device finding, 2026-08-04/05 — this was logged in the very first
  // batch (matching every sibling list function) but missed in the big
  // implementation sweep; only the Institution equivalent got fixed then.
  return rows
    .filter((row) => row.Donor_ID === donorId)
    .sort(
      (a, b) =>
        parseSheetDate(b.Date_Submitted) - parseSheetDate(a.Date_Submitted) ||
        sequenceSuffix(b.Public_Donation_Code) - sequenceSuffix(a.Public_Donation_Code),
    )
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
): Promise<Map<string, { name: string | null; logo: string | null; phone: string | null }>> {
  const [userRows, corpRows] = await Promise.all([
    getRows(SHEET_TABS.users),
    getRows(SHEET_TABS.corporateAccounts),
  ]);
  const userById = new Map(userRows.map((u) => [u.User_ID, u]));
  const corpById = new Map(corpRows.map((c) => [c.Corporate_Account_ID, c]));

  const result = new Map<string, { name: string | null; logo: string | null; phone: string | null }>();
  for (const donorId of donorIds) {
    const donor = userById.get(donorId);
    if (!donor) {
      result.set(donorId, { name: null, logo: null, phone: null });
      continue;
    }
    // RC1 pickup-location fix — Donor_Phone follows the same
    // Show_Name_To_Institutions gate as the name below, including for
    // Corporate donors: the company name/logo is institutional (always
    // shown), but the phone on file is still the individual donor's own,
    // so it stays gated on their personal consent flag.
    const phone = donor.Show_Name_To_Institutions === 'TRUE' ? donor.Phone || null : null;
    if (donor.Donor_Subtype === 'Corporate' && donor.Corporate_Account_ID) {
      const corp = corpById.get(donor.Corporate_Account_ID);
      if (corp) {
        result.set(donorId, { name: corp.Company_Name || null, logo: toProxiedUrl(corp.Logo), phone });
        continue;
      }
    }
    result.set(donorId, {
      name: donor.Show_Name_To_Institutions === 'TRUE' ? donor.Name || null : null,
      logo: null,
      phone,
    });
  }
  return result;
}

/**
 * Bug fix, 2026-08-08 — the Admin Donations page was labeling any donation
 * with a Success_Stories row as "✓ Já publicado no Feed de Impacto", even
 * when that story's Status was still Pending (an institution submitted it,
 * but Admin hasn't approved it via the separate moderation queue yet — see
 * approveSuccessStory in success-stories.ts). A Pending story isn't visible
 * to any donor, so the label was actively misleading. Exposes the real
 * status instead of a plain boolean so the UI can tell the two apart.
 */
function buildStoryStatusByDonationId(
  successStoryRows: Record<string, string>[],
): Map<string, SuccessStoryStatus> {
  return new Map(successStoryRows.map((r) => [r.Donation_ID, r.Status as SuccessStoryStatus]));
}

async function toInstitutionDonationViews(
  rows: Record<string, string>[],
): Promise<InstitutionDonationView[]> {
  const displays = await resolveDonorDisplays(new Set(rows.map((r) => r.Donor_ID)));
  return rows.map((row) => {
    const display = displays.get(row.Donor_ID) ?? { name: null, logo: null, phone: null };
    return {
      ...rowToDonation(row),
      Donor_Display_Name: display.name,
      Donor_Display_Logo: display.logo,
      Donor_Phone: display.phone,
    };
  });
}

/**
 * Admin Web App — shared enrichment behind every Admin donation list
 * (in-flight, all, pending-review): resolves the claiming institution's
 * identity, the linked Success Story's moderation status, and (RC1 RECEBER)
 * the computed Available/Reserved/Delivered state for People-category rows.
 * Centralized so the three admin list functions can't drift from each other.
 */
async function toAdminDonationViews(rows: Record<string, string>[]): Promise<AdminDonationView[]> {
  const views = await toInstitutionDonationViews(rows);
  const institutionRows = await getRows(SHEET_TABS.institutions);
  const institutionById = new Map(institutionRows.map((r) => [r.Institution_ID, r]));
  const successStoryRows = await getRows(SHEET_TABS.successStories);
  const storyStatusByDonationId = buildStoryStatusByDonationId(successStoryRows);

  return views.map((view) => {
    const institution = view.Claimed_By_Institution_ID
      ? institutionById.get(view.Claimed_By_Institution_ID)
      : undefined;
    const storyStatus = storyStatusByDonationId.get(view.Donation_ID) ?? null;
    return {
      ...view,
      Claimed_By_Institution_Name: institution?.Name || null,
      Claimed_By_Institution_Logo: toProxiedUrl(institution?.Logo),
      Has_Success_Story: storyStatus !== null,
      Success_Story_Status: storyStatus,
      Individual_State: computeIndividualState(view),
    };
  });
}

/**
 * "Available Donations" browse for verified institutions and animal shelters
 * (spec 9.2). Phase 3A Module 1: scoped to the claiming org's own operating
 * country (Institutions.Country_ID) — an Angola institution has no reason to
 * see, and shouldn't see, a donation submitted in Portugal. Institution-side
 * scoping uses the institution's Country_ID rather than a personal Active
 * Country, since an institution's operating country is a fixed operational
 * fact, not something the browsing user should toggle.
 *
 * RC1 RECEBER — `category` selects which Recipient_Category this org may see
 * ('Institutions' or 'Animal_Shelters'); combined with the Admin approval
 * gate via isVisibleForRecipients, replacing the old Status-only filter.
 */
export async function listAvailableDonations(
  category: RecipientCategory,
  countryId?: string,
): Promise<InstitutionDonationView[]> {
  const rows = await getRows(SHEET_TABS.donations);
  // Pilot feedback, 2026-08-05: unsorted — same missing-sort pattern already
  // fixed on listDonationsByDonor and listDonationsClaimedByInstitution, but
  // never caught here. Newest-submitted first, matching every sibling list.
  const filtered = rows
    .filter((row) => isVisibleForRecipients(row, category) && (!countryId || row.Country_ID === countryId))
    .sort(
      (a, b) =>
        parseSheetDate(b.Date_Submitted) - parseSheetDate(a.Date_Submitted) ||
        sequenceSuffix(b.Public_Donation_Code) - sequenceSuffix(a.Public_Donation_Code),
    );
  return toInstitutionDonationViews(filtered);
}

/**
 * RC1 RECEBER — the RECEBER browse list for individuals: same approval +
 * Recipient_Category='People' gate as listAvailableDonations, plus excludes
 * anything currently reserved by someone else (lazy expiry — a reservation
 * older than 24h is simply not counted as active here, no separate release
 * job needed). Not scoped by country: RC1 has limited collection points and
 * the spec doesn't ask for individual-side country scoping the way the
 * Institution flow has.
 */
export async function listAvailableDonationsForIndividuals(): Promise<Donation[]> {
  const rows = await getRows(SHEET_TABS.donations);
  return rows
    .filter((row) => isVisibleForRecipients(row, 'People') && !isReservationActive(row))
    .sort(
      (a, b) =>
        parseSheetDate(b.Date_Submitted) - parseSheetDate(a.Date_Submitted) ||
        sequenceSuffix(b.Public_Donation_Code) - sequenceSuffix(a.Public_Donation_Code),
    )
    .map(rowToDonation);
}

/**
 * RC1 RECEBER — a reserved item drops out of listAvailableDonationsForIndividuals
 * (it's no longer "available"), so without this there was no way for
 * ReceberScreen to find it again after a re-render, app backgrounding, or
 * navigating away before tapping "Confirmar recebimento". Scoped to this
 * caller's own active reservations only — mirrors listDonationsClaimedByInstitution's
 * "my in-flight items" role for the individual-recipient side.
 */
export async function listDonationsReservedByIndividual(userId: string): Promise<Donation[]> {
  const rows = await getRows(SHEET_TABS.donations);
  return rows
    // Status==='Pending' excludes a reservation already confirmed via
    // confirmIndividualPickup (Status flips to 'Delivered' there, but
    // Reserved_By_User_ID/Reserved_At are deliberately left in place as a
    // completion record) — without this check a just-completed pickup kept
    // reading as "still reserved" here for up to 24h.
    .filter((row) => row.Status === 'Pending' && row.Reserved_By_User_ID === userId && isReservationActive(row))
    .sort((a, b) => parseSheetDate(b.Reserved_At) - parseSheetDate(a.Reserved_At))
    .map(rowToDonation);
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
    .sort(
      (a, b) =>
        parseSheetDate(b.Date_Claimed) - parseSheetDate(a.Date_Claimed) ||
        sequenceSuffix(b.Public_Donation_Code) - sequenceSuffix(a.Public_Donation_Code),
    );
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
    .sort(
      (a, b) =>
        parseSheetDate(b.Date_Claimed) - parseSheetDate(a.Date_Claimed) ||
        sequenceSuffix(b.Public_Donation_Code) - sequenceSuffix(a.Public_Donation_Code),
    );
  return toAdminDonationViews(filtered);
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
  const sorted = [...rows].sort(
    (a, b) =>
      parseSheetDate(b.Date_Submitted) - parseSheetDate(a.Date_Submitted) ||
      sequenceSuffix(b.Public_Donation_Code) - sequenceSuffix(a.Public_Donation_Code),
  );
  return toAdminDonationViews(sorted);
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
  if (patch.Recipient_Category !== undefined) rowPatch.Recipient_Category = patch.Recipient_Category;
  if (patch.Delivery_Method !== undefined) rowPatch.Delivery_Method = patch.Delivery_Method;
  if (patch.Photo !== undefined) rowPatch.Photo = patch.Photo;
  if (patch.Location !== undefined) rowPatch.Location = toSheetLatLong(patch.Location);
  if (patch.City !== undefined) rowPatch.City = patch.City?.trim() ?? '';
  if (patch.Address !== undefined) rowPatch.Address = patch.Address?.trim() ?? '';

  await updateRow(SHEET_TABS.donations, 'Donation_ID', donationId, rowPatch);
  const updated = await getDonation(donationId);
  if (!updated) throw new Error('Donation vanished after update');
  return updated;
}

/**
 * Launch-readiness module, 2026-08-07 — Admin-side photo moderation. Unlike
 * the donor's own editDonation above, this isn't restricted to the donor who
 * submitted it or to Pending status: a bad/unclear photo can be spotted at
 * any point in a donation's lifecycle, and only Admin can act on it.
 */
export async function adminReplaceDonationPhoto(donationId: string, photoUrl: string): Promise<Donation> {
  const existing = await getDonation(donationId);
  if (!existing) throw new ValidationError('Doação não encontrada');

  await updateRow(SHEET_TABS.donations, 'Donation_ID', donationId, { Photo: photoUrl });
  const updated = await getDonation(donationId);
  if (!updated) throw new Error('Donation vanished after update');
  return updated;
}

/**
 * Institution claims a Pending donation. Sheets has no transactions, so this
 * check-then-write has a small race window if two institutions claim at the
 * same instant — accepted as a known V1 limitation given expected launch scale.
 */
export async function claimDonation(
  institutionId: string,
  donationId: string,
  expectedCategory: RecipientCategory,
): Promise<Donation> {
  const existing = await getDonation(donationId);
  if (!existing) throw new ValidationError('Doação não encontrada');
  if (existing.Status !== 'Pending') throw new ValidationError('A doação já não está disponível');
  // RC1 RECEBER — defense in depth: listAvailableDonations already hides
  // anything not Approved, so an institution should never have this ID in
  // the first place, but claiming must never succeed on an unapproved
  // donation even if the ID leaked some other way (e.g. a stale link).
  if (existing.Approval_Status !== 'Approved') {
    throw new ValidationError('Esta doação ainda não foi aprovada pela equipa Wafina');
  }
  // RC1 audit fix, 2026-08-10 — same defense-in-depth reasoning as the
  // Approval_Status check above: listAvailableDonations already scopes each
  // caller to their own Recipient_Category, but claiming itself must never
  // succeed cross-category (e.g. an Institution claiming a People-only
  // RECEBER donation) even if the ID leaked some other way. Confirmed via
  // live audit that this was previously unchecked here.
  if (existing.Recipient_Category !== expectedCategory) {
    throw new ValidationError('Esta doação não está disponível para esta instituição');
  }

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
    message: `A sua doação de ${updated.Item_Type} foi aceite por uma instituição. Método de entrega: ${
      updated.Delivery_Method ? DELIVERY_METHOD_LABEL[updated.Delivery_Method] : 'não especificado'
    }`,
  });

  return updated;
}

/**
 * RC1 RECEBER — a Pessoa reserves an approved, People-category donation for
 * themselves. Same accepted check-then-write race window as claimDonation
 * (documented above); the reservation itself is what prevents a second
 * person winning the race in practice — expired reservations (see
 * isReservationActive) are treated as free, so this also doubles as the
 * "auto-release after 24h" mechanism with no background job required.
 * Status stays 'Pending' throughout the reservation — only confirmIndividual
 * Pickup moves it to 'Delivered'.
 */
export async function reserveDonationForIndividual(userId: string, donationId: string): Promise<Donation> {
  // RC1 RECEBER eligibility rule — checked first and freshly on every
  // attempt (never trusts a client-side "you're eligible" flag): one active
  // reservation at a time, and a cooldown (RECEBER_COOLDOWN_MS) after a
  // confirmed receipt.
  // Same small accepted race window as the double-reservation check below —
  // proportionate to this Sheets-backed, non-high-concurrency system.
  const eligibility = await checkReceberEligibility(userId);
  if (!eligibility.eligible) {
    if (eligibility.reason === 'active_reservation') {
      throw new ValidationError('Já tem uma doação reservada. Conclua ou aguarde a expiração dessa reserva primeiro.');
    }
    throw new ValidationError(
      `Já recebeu uma doação recentemente. Pode reservar novamente a partir de ${new Date(eligibility.nextEligibleAt!).toLocaleDateString('pt-PT')}.`,
    );
  }

  const existing = await getDonation(donationId);
  if (!existing) throw new ValidationError('Doação não encontrada');
  if (existing.Status !== 'Pending' || existing.Approval_Status !== 'Approved') {
    throw new ValidationError('A doação já não está disponível');
  }
  if (existing.Recipient_Category !== 'People') {
    throw new ValidationError('Esta doação não está disponível para receção individual');
  }
  if (isReservationActive(existing)) {
    throw new ValidationError('Esta doação já está reservada por outra pessoa');
  }

  await updateRow(SHEET_TABS.donations, 'Donation_ID', donationId, {
    Reserved_By_User_ID: userId,
    Reserved_At: nowIso(),
  });

  const updated = await getDonation(donationId);
  if (!updated) throw new Error('Donation vanished after reservation');

  await createNotification({
    recipientUserId: updated.Donor_ID,
    notificationType: 'donation_reserved',
    entityType: 'Donation',
    entityId: updated.Donation_ID,
    message: `A sua doação de ${updated.Item_Type} foi reservada por alguém que precisa dela.`,
  });

  return updated;
}

/**
 * RC1 RECEBER — the Pessoa confirms they physically received the item,
 * closing out SELECT -> RESERVE 24H -> CONFIRM. Only the person who holds the
 * still-active reservation may confirm it; reuses the existing 'Delivered'
 * terminal Status (no new Status value needed) alongside the individual-only
 * Individual_Delivered_At timestamp.
 */
export async function confirmIndividualPickup(userId: string, donationId: string): Promise<Donation> {
  const existing = await getDonation(donationId);
  if (!existing) throw new ValidationError('Doação não encontrada');
  if (existing.Reserved_By_User_ID !== userId) {
    throw new ValidationError('Esta doação não está reservada para si');
  }
  if (!isReservationActive(existing)) {
    throw new ValidationError('A reserva expirou');
  }

  await updateRow(SHEET_TABS.donations, 'Donation_ID', donationId, {
    Status: 'Delivered',
    Individual_Delivered_At: nowIso(),
  });

  const updated = await getDonation(donationId);
  if (!updated) throw new Error('Donation vanished after confirming pickup');

  await createNotification({
    recipientUserId: updated.Donor_ID,
    notificationType: 'donation_delivered',
    entityType: 'Donation',
    entityId: updated.Donation_ID,
    message: `A sua doação de ${updated.Item_Type} foi recebida.`,
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
  // Bug fix, 2026-08-08 — a Pending donation has no claiming institution yet,
  // so there's nothing to estimate collection/delivery against. The Admin UI
  // no longer offers this for Pending donations; guarding here too in case
  // this is ever called directly.
  if (existing.Status === 'Pending') {
    throw new ValidationError('Esta doação ainda não foi aceite por nenhuma instituição.');
  }

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
