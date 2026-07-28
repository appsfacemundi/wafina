/**
 * Confirmed against real data in the live sheet (not guessed). Spec 12.1 calls
 * this an "extensible" list, so Donation.Item_Type stays a plain string —
 * this is the current known-good set for building a selector UI, not a
 * server-enforced whitelist.
 */
export const ITEM_TYPES = [
  'Roupas',
  'Sapatos',
  'Cobertores e roupa de cama',
  'Material escolar',
] as const;
