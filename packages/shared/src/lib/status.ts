import type { DeliveryMethod } from '../enums/delivery-method';
import type { DonationStatus } from '../enums/donation-status';
import type { RecipientCategory } from '../enums/recipient-category';

/** Shared between Donor and Institution apps so a status always reads identically. */
export const DONATION_STATUS_LABEL: Record<DonationStatus, string> = {
  Pending: 'Pendente',
  Claimed: 'Aceite',
  Collection_Scheduled: 'Recolha Agendada',
  Collected: 'Recolhida',
  Delivered: 'Entregue',
};

/**
 * Real-device finding, 2026-08-04: Claimed/Collection_Scheduled/Collected
 * previously all shared 'info', so three different real-world stages read as
 * the same badge color. Spread across distinct tones so each stage of the
 * journey is visually distinguishable, not just Pending vs. everything-else
 * vs. Delivered.
 */
export const DONATION_STATUS_TONE: Record<DonationStatus, 'warning' | 'info' | 'success' | 'neutral'> = {
  Pending: 'warning',
  Claimed: 'neutral',
  Collection_Scheduled: 'info',
  Collected: 'info',
  Delivered: 'success',
};

/** Epic 0.6, 2026-08-06 — same Record<EnumType, string> pattern as DONATION_STATUS_LABEL above. */
export const RECIPIENT_CATEGORY_LABEL: Record<RecipientCategory, string> = {
  People: '👨‍👩‍👧 Pessoas',
  Institutions: '🏢 Instituições',
  Animal_Shelters: '🐾 Abrigos de Animais',
};

export const DELIVERY_METHOD_LABEL: Record<DeliveryMethod, string> = {
  Donor_Delivers: '🚗 Doador entrega',
  Pickup_Required: '📦 Necessita recolha',
};

type JourneyStatus = Exclude<DonationStatus, 'Pending'>;

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
