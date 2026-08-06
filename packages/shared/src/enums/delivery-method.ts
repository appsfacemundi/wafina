/** Epic 0.6, 2026-08-06 — required at donation creation. */
export const DELIVERY_METHODS = ['Donor_Delivers', 'Pickup_Required'] as const;
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number];
