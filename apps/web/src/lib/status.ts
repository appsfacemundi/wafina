import type { DonationStatus } from '@wafina/shared';

export const DONATION_STATUS_LABEL: Record<DonationStatus, string> = {
  Pending: 'Pendente',
  Claimed: 'Reclamado',
  Delivered: 'Entregue',
};

export const DONATION_STATUS_TONE: Record<DonationStatus, 'warning' | 'info' | 'success'> = {
  Pending: 'warning',
  Claimed: 'info',
  Delivered: 'success',
};
