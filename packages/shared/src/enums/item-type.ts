/**
 * Confirmed against real data in the live sheet (not guessed). Spec 12.1 calls
 * this an "extensible" list, so Donation.Item_Type stays a plain string —
 * this is the current known-good set for building a selector UI, not a
 * server-enforced whitelist.
 *
 * RC1 Phase 3 scope broadening (2026-08-02, stakeholder-approved Feature
 * Freeze exception): added the three food categories below so the platform's
 * store listings/policies can accurately claim both perishable and
 * non-perishable goods. Perishable entries pair with the food-safety
 * disclaimer in the Terms & Conditions (donor is responsible for the item
 * being safe/unexpired at transfer).
 */
export const ITEM_TYPES = [
  'Roupas',
  'Sapatos',
  'Cobertores e roupa de cama',
  'Material escolar',
  'Alimentos frescos',
  'Refeições preparadas',
  'Mercearia/Alimentos não perecíveis',
] as const;
