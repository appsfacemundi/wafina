/**
 * Stabilization module (2026-07-31) — the single source of truth for
 * human-readable labels of Institution profile fields. Found via a real leak:
 * the change-request notification interpolated the raw Sheet column name
 * (e.g. "Needs_List") straight into the message shown to the institution
 * ("O seu pedido de alteração ao campo \"Needs_List\" foi enviado ao Admin.").
 * Internal field/column names must never reach a user-facing string —
 * this map is now used both server-side (the notification message) and by
 * every frontend's "Solicitar alteração" field picker, replacing three
 * separate copies of the same dictionary that had already drifted out of
 * sync with each other.
 */
export const INSTITUTION_FIELD_LABELS: Record<string, string> = {
  Name: 'Nome',
  Type: 'Tipo',
  Location: 'Localização',
  Needs_List: 'Itens Necessários',
  Logo: 'Logótipo',
};

/** Falls back to the raw key only if it's ever missing from the map above — never surfaced normally. */
export function institutionFieldLabel(field: string): string {
  return INSTITUTION_FIELD_LABELS[field] ?? field;
}
