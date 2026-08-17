import type { DeliveryMethod } from '../enums/delivery-method';
import type { DonationApprovalStatus } from '../enums/donation-approval-status';
import type { DonationStatus } from '../enums/donation-status';
import type { IndividualDonationState } from '../enums/individual-donation-state';
import type { RecipientCategory } from '../enums/recipient-category';

/** Shared between Donor and Institution apps so a status always reads identically. */
export const DONATION_STATUS_LABEL: Record<DonationStatus, string> = {
  Pending: 'Pendente',
  Claimed: 'Aceite',
  Collection_Scheduled: 'Recolha Agendada',
  Collected: 'Recolhida',
  Delivered: 'Entregue',
  Cancelled: 'Cancelada',
};

/**
 * RC1 EN/PT localization, 2026-08-12 — the DOMAIN VALUE (DonationStatus, e.g.
 * 'Pending') never changes; DONATION_STATUS_LABEL above is a fixed-PT DISPLAY
 * LABEL kept as-is so existing (non-i18n) web callers are untouched. Mobile
 * apps that need a translated label should resolve through this key map
 * instead: `t(DONATION_STATUS_LABEL_KEY[status])`. Keys point into each
 * mobile app's own `status.donation.*` i18n namespace.
 */
export const DONATION_STATUS_LABEL_KEY: Record<DonationStatus, string> = {
  Pending: 'status.donation.pending',
  Claimed: 'status.donation.claimed',
  Collection_Scheduled: 'status.donation.collectionScheduled',
  Collected: 'status.donation.collected',
  Delivered: 'status.donation.delivered',
  Cancelled: 'status.donation.cancelled',
};

/**
 * Real-device finding, 2026-08-04: Claimed/Collection_Scheduled/Collected
 * previously all shared 'info', so three different real-world stages read as
 * the same badge color. Spread across distinct tones so each stage of the
 * journey is visually distinguishable, not just Pending vs. everything-else
 * vs. Delivered.
 */
export const DONATION_STATUS_TONE: Record<DonationStatus, 'warning' | 'info' | 'success' | 'neutral' | 'danger'> = {
  Pending: 'warning',
  Claimed: 'neutral',
  Collection_Scheduled: 'info',
  Collected: 'info',
  Delivered: 'success',
  Cancelled: 'danger',
};

/**
 * Bug fix, 2026-08-11 — DONATION_STATUS_LABEL above reads Status alone, which
 * stays 'Pending' both before AND after Admin approval (Status only tracks
 * claim/delivery progress; Approval_Status is a separate dimension — see
 * isVisibleForRecipients). A donor viewing their own donation therefore saw
 * the identical "Pendente" label whether Admin had reviewed it yet or not,
 * which read as "my approved donation is stuck." This donor-facing wrapper
 * makes the Approval_Status distinction visible instead of collapsing it:
 * still-under-review and rejected donations get their own label, so once
 * Admin approves, "Pendente" starts meaning something new to the donor
 * (listed, waiting for a recipient) instead of looking unchanged.
 * Institution/mobile-institution screens intentionally keep using
 * DONATION_STATUS_LABEL directly — they only ever see already-Approved
 * donations (isVisibleForRecipients), so this distinction doesn't apply there.
 */
export function donorDonationStatusLabel(donation: {
  Status: DonationStatus;
  Approval_Status: DonationApprovalStatus;
}): string {
  if (donation.Approval_Status === 'Pending_Review') return 'Em análise pela equipa Wafina';
  if (donation.Approval_Status === 'Rejected') return 'Rejeitada';
  return DONATION_STATUS_LABEL[donation.Status];
}

/** Translated counterpart to donorDonationStatusLabel above — see DONATION_STATUS_LABEL_KEY. */
export function donorDonationStatusLabelKey(donation: {
  Status: DonationStatus;
  Approval_Status: DonationApprovalStatus;
}): string {
  if (donation.Approval_Status === 'Pending_Review') return 'status.donation.pendingReview';
  if (donation.Approval_Status === 'Rejected') return 'status.donation.rejected';
  return DONATION_STATUS_LABEL_KEY[donation.Status];
}

export function donorDonationStatusTone(donation: {
  Status: DonationStatus;
  Approval_Status: DonationApprovalStatus;
}): 'warning' | 'info' | 'success' | 'neutral' | 'danger' {
  if (donation.Approval_Status === 'Pending_Review') return 'info';
  if (donation.Approval_Status === 'Rejected') return 'danger';
  return DONATION_STATUS_TONE[donation.Status];
}

/** Epic 0.6, 2026-08-06 — same Record<EnumType, string> pattern as DONATION_STATUS_LABEL above. */
export const RECIPIENT_CATEGORY_LABEL: Record<RecipientCategory, string> = {
  People: '👨‍👩‍👧 Pessoas',
  Institutions: '🏢 Instituições',
  Animal_Shelters: '🐾 Abrigos de Animais',
};

/** Translated counterpart — see DONATION_STATUS_LABEL_KEY for the pattern. Keys keep the same emoji prefix. */
export const RECIPIENT_CATEGORY_LABEL_KEY: Record<RecipientCategory, string> = {
  People: 'status.recipientCategory.people',
  Institutions: 'status.recipientCategory.institutions',
  Animal_Shelters: 'status.recipientCategory.animalShelters',
};

export const DELIVERY_METHOD_LABEL: Record<DeliveryMethod, string> = {
  Donor_Delivers: '🚗 Doador entrega',
  Pickup_Required: '📦 Necessita recolha',
};

/** Translated counterpart — see DONATION_STATUS_LABEL_KEY for the pattern. */
export const DELIVERY_METHOD_LABEL_KEY: Record<DeliveryMethod, string> = {
  Donor_Delivers: 'status.deliveryMethod.donorDelivers',
  Pickup_Required: 'status.deliveryMethod.pickupRequired',
};

/** RC1 RECEBER — Admin-facing label for the computed People-category state. */
export const INDIVIDUAL_DONATION_STATE_LABEL: Record<IndividualDonationState, string> = {
  Available: 'Disponível',
  Reserved: 'Reservado',
  Delivered: 'Recebido',
};

/** Translated counterpart — see DONATION_STATUS_LABEL_KEY for the pattern. */
export const INDIVIDUAL_DONATION_STATE_LABEL_KEY: Record<IndividualDonationState, string> = {
  Available: 'status.individualState.available',
  Reserved: 'status.individualState.reserved',
  Delivered: 'status.individualState.delivered',
};

export const INDIVIDUAL_DONATION_STATE_TONE: Record<IndividualDonationState, 'warning' | 'info' | 'success'> = {
  Available: 'info',
  Reserved: 'warning',
  Delivered: 'success',
};

/** Cancelled is excluded — it's a terminal off-ramp, never a step on the claim->deliver journey. */
type JourneyStatus = Exclude<DonationStatus, 'Pending' | 'Cancelled'>;

/** Ordered journey for the timeline component — Pending isn't shown (an institution only sees post-acceptance steps). */
export const DONATION_JOURNEY_STEPS: JourneyStatus[] = [
  'Claimed',
  'Collection_Scheduled',
  'Collected',
  'Delivered',
];

/**
 * Institution App Polish module — which Donation date field marks each
 * journey step as reached, for the timeline component. Keyed by the
 * DONATION_JOURNEY_STEPS status name, not by Donation's own field name,
 * since those two naming schemes diverge (e.g. Claimed -> Date_Claimed).
 */
export const DONATION_JOURNEY_DATE_FIELD: Record<
  JourneyStatus,
  'Date_Claimed' | 'Date_Collection_Scheduled' | 'Date_Collected' | 'Date_Delivered'
> = {
  Claimed: 'Date_Claimed',
  Collection_Scheduled: 'Date_Collection_Scheduled',
  Collected: 'Date_Collected',
  Delivered: 'Date_Delivered',
};
