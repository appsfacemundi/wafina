/**
 * Epic 0.6, 2026-08-06 — who the donor intends the donation for. A donation
 * attribute only; independent of which institution actually claims/delivers
 * it. Animal Shelters remain ordinary verified Institutions, same approval
 * workflow — this is not a new institution type or matching rule.
 */
export const RECIPIENT_CATEGORIES = ['People', 'Institutions', 'Animal_Shelters'] as const;
export type RecipientCategory = (typeof RECIPIENT_CATEGORIES)[number];
