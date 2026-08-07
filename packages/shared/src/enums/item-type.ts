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
 *
 * 'Medicamentos', 2026-08-07 (stakeholder-approved Feature Freeze exception,
 * same basis as the food categories above) — pairs with its own donor-facing
 * disclaimer at submission (see MEDICATION_DISCLAIMER in @wafina/shared) and
 * matching Terms & Conditions language: over-the-counter only, unexpired,
 * sealed original packaging. Same "donor responsible, institution inspects
 * and may refuse" liability model as perishables, not a new legal framework.
 */
export const ITEM_TYPES = [
  'Roupas',
  'Sapatos',
  'Cobertores e roupa de cama',
  'Material escolar',
  'Alimentos frescos',
  'Refeições preparadas',
  'Mercearia/Alimentos não perecíveis',
  'Medicamentos',
] as const;

/**
 * Shown to the donor at submission whenever Item_Type === 'Medicamentos' —
 * see the ITEM_TYPES comment for why this category exists and what it pairs
 * with. Kept here (not inline in each screen) so mobile and web show
 * identical wording, the same way DELIVERY_METHOD_LABEL etc. are shared.
 */
export const MEDICATION_DISCLAIMER =
  'Apenas medicamentos não sujeitos a receita médica (venda livre), dentro do prazo de validade e na embalagem original selada. A instituição recetora pode recusar qualquer item que considere não seguro.';
