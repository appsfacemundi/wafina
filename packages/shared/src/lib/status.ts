import type { DonationStatus } from '../enums/donation-status';

/** Shared between Donor and Institution apps so a status always reads identically. */
export const DONATION_STATUS_LABEL: Record<DonationStatus, string> = {
  Pending: 'Pendente',
  Claimed: 'Aceite',
  Delivered: 'Entregue',
};

export const DONATION_STATUS_TONE: Record<DonationStatus, 'warning' | 'info' | 'success'> = {
  Pending: 'warning',
  Claimed: 'info',
  Delivered: 'success',
};
