import type { GeoPoint } from './geo-point';

/**
 * RECEBER collection-point flow, 2026-08-10 — the physical Wafina-run
 * location a People-category recipient goes to collect a reserved donation.
 * One row per country (Country_ID-keyed); adding a new country's point is a
 * data operation, never a code change — see Collection_Points sheet tab.
 */
export interface CollectionPoint {
  Collection_Point_ID: string;
  Country_ID: string;
  Name: string;
  Address: string;
  /**
   * V2 GPS distance (2026-08-17) — added so RECEBER can show "X km do ponto
   * de recolha" (informational only, no confirm dialog — see the plan's
   * RECEBER scoping decision). Null until geocoded; the informational line
   * simply doesn't render for a country whose point predates this field.
   */
  Location: GeoPoint | null;
  City: string | null;
  Phone: string | null;
  Email: string | null;
  /** Free text (e.g. "Segunda–Sexta: 09:00–18:00"); null when not yet configured — never invented client-side. */
  Opening_Hours: string | null;
  /**
   * Free text walking/landmark directions (e.g. "perto do BFA, suba até o
   * cruzamento com o mercado..."), supplementary to the map link — useful in
   * areas where street addresses alone don't get someone there reliably.
   * Null when not yet configured.
   */
  Directions: string | null;
}
