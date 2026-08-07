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
 * 'Material Médico', 2026-08-07 (stakeholder-approved Feature Freeze
 * exception, same basis as the food categories above) — corrected same-day
 * from an initial 'Medicamentos' (pharmaceuticals) framing: the actual scope
 * is medical *supplies and equipment* (bandages, wheelchairs, thermometers,
 * etc. — see MEDICAL_SUPPLY_EXAMPLES), not medicine, which carries much
 * heavier regulatory baggage (prescriptions, controlled substances) that
 * doesn't apply here. Pairs with a donor-facing note at submission (see
 * MEDICAL_SUPPLY_INFO) and a full example list shown in Settings/Definições.
 *
 * 'Roupa de bebé', 2026-08-07 — no special handling needed, same as
 * 'Roupas'/'Sapatos'.
 */
export const ITEM_TYPES = [
  'Roupas',
  'Roupa de bebé',
  'Sapatos',
  'Cobertores e roupa de cama',
  'Material escolar',
  'Alimentos frescos',
  'Refeições preparadas',
  'Mercearia/Alimentos não perecíveis',
  'Material Médico',
] as const;

/**
 * Shown to the donor at submission whenever Item_Type === 'Material Médico'
 * — see the ITEM_TYPES comment for why this category exists. Kept here (not
 * inline in each screen) so mobile and web show identical wording, the same
 * way DELIVERY_METHOD_LABEL etc. are shared.
 */
export const MEDICAL_SUPPLY_INFO =
  'Material médico limpo, funcional e em boas condições de higiene — não medicamentos. Veja exemplos em Definições.';

/**
 * Full reference list for what counts as 'Material Médico', shown in
 * Settings/Definições (mobile + web) rather than crammed into the donation
 * form itself — a donor deciding whether an item qualifies needs this once,
 * not every time they open the form.
 */
export const MEDICAL_SUPPLY_EXAMPLES: readonly { emoji: string; label: string }[] = [
  { emoji: '🩹', label: 'Ligaduras e pensos' },
  { emoji: '🦽', label: 'Cadeiras de rodas' },
  { emoji: '🩼', label: 'Canadianas e andarilhos' },
  { emoji: '🩺', label: 'Aparelhos de tensão arterial' },
  { emoji: '🌡️', label: 'Termómetros' },
  { emoji: '🫁', label: 'Nebulizadores' },
  { emoji: '🧤', label: 'Luvas e máscaras' },
  { emoji: '🍼', label: 'Material médico para bebés' },
  { emoji: '🧪', label: 'Material de teste de diabetes' },
  { emoji: '🛏️', label: 'Camas hospitalares e equipamento médico' },
] as const;
