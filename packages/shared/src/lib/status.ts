import type { DonationStatus } from '../enums/donation-status';

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
