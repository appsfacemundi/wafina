import type { GeoLevel } from '../enums/geo-level';

/**
 * The permanent geographic model for Wafina (Phase 3A, Module 1). A single
 * self-referencing table rather than fixed Country/Province/Municipality
 * tables, because real administrative structures vary by country (Angola:
 * Província → Município → Comuna; Portugal: Distrito → Concelho → Freguesia)
 * and a fixed-depth schema would need redesigning the moment one didn't fit.
 *
 * V1 populates Country-level rows only. Deeper levels (Province, Municipality,
 * District) get added later, per country, as pure data — no schema change.
 */
export interface GeoRegion {
  Region_ID: string;
  Name: string;
  Level: GeoLevel;
  /** Null only for a root Region grouping above Country, if that's ever used. */
  Parent_Region_ID: string | null;
  /**
   * Denormalized pointer to the ancestor Country-level row (a Country row
   * points to itself here). Sheets can't do recursive tree-walking, so this
   * makes "everything in Country X" a flat filter instead of a tree walk.
   */
  Country_ID: string;
  /** ISO 3166-1 alpha-2, set on Country-level rows only (e.g. "AO", "PT"). */
  ISO_Code: string | null;
  /** Lets Admin "launch" a country by flipping one flag — no redeploy. */
  Active: boolean;
}
