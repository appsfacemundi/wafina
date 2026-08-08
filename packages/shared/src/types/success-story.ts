import type { SuccessStoryStatus } from '../enums/success-story-status';

/**
 * Phase 3A Module 2 — lightweight MVP. Deliberately minimal (Title,
 * Description, one Image) per instruction, but the shape is reusable as-is
 * for a future public Impact Gallery, Corporate CSR/NGO/annual reports —
 * those are presentation layers over this same data, not a different model.
 */
export interface SuccessStory {
  Success_Story_ID: string;
  Institution_ID: string;
  Donation_ID: string;
  /** Denormalized from the donation at creation time — lets the donor-side query skip a join. */
  Donor_ID: string;
  Title: string;
  Description: string;
  /** Google Drive URL, same upload path as donation photos. */
  Image: string;
  /**
   * Admin moderation module (2026-07-31) — defaults to Pending on publish.
   * Only visible to the donor (and any future public gallery) once Approved;
   * the institution always sees its own stories regardless of status via the
   * status filter on "Histórias de Impacto".
   */
  Status: SuccessStoryStatus;
  /** Set when Admin rejects — shown to the institution so they know why. Null otherwise. */
  Rejection_Reason: string | null;
  /** The institution's User_ID at time of publish — stored explicitly rather than assumed, in case an institution ever has more than one author account. */
  Author_User_ID: string;
  Date_Published: string;
  /**
   * Attribution module, 2026-08-08 — chosen by whoever creates the story
   * (institution submitting, or Admin's manual upload). Defaults true. When
   * false, Institution_Name/Item_Type below are withheld server-side (never
   * sent to the client at all, not just hidden in the UI) — the free-text
   * Title/Description are unaffected either way.
   */
  Show_Donation_Details: boolean;
  /** Joined from the donation at read time; null when Show_Donation_Details is false. */
  Institution_Name: string | null;
  /** Joined from the donation at read time; null when Show_Donation_Details is false. */
  Item_Type: string | null;
}

/** Admin moderation queue — same story plus the institution's logo (Institution_Name already on SuccessStory), always visible to Admin regardless of Show_Donation_Details. */
export interface AdminSuccessStoryView extends SuccessStory {
  Institution_Logo: string | null;
}
