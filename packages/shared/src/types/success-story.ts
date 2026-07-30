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
   * Defaults to Approved today (no Admin Panel exists to moderate yet) — the
   * column exists so a future moderation workflow can default new stories to
   * Pending and approve/reject them without a schema change.
   */
  Status: SuccessStoryStatus;
  /** The institution's User_ID at time of publish — stored explicitly rather than assumed, in case an institution ever has more than one author account. */
  Author_User_ID: string;
  Date_Published: string;
}
