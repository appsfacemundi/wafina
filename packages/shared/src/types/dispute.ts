import type { DisputeStatus } from '../enums/dispute-status';

export interface Dispute {
  Dispute_ID: string;
  Donation_ID: string;
  /** FK -> Users.User_ID. Formalized from a plain Text field (spec 7.2.1). */
  Raised_By: string;
  Issue_Description: string;
  Status: DisputeStatus;
  /** NEW column — does not exist in the reference Sheet yet; added in Module 3. */
  Resolution_Notes: string | null;
  Date_Raised: string;
  /** NEW column — does not exist in the reference Sheet yet; added in Module 3. */
  Date_Resolved: string | null;
}

/** Admin moderation queue — same dispute plus enough context (institution + donation) to resolve it. */
export interface AdminDisputeView extends Dispute {
  Institution_Name: string | null;
  Institution_Logo: string | null;
  Donation_Item_Type: string | null;
  Donation_Public_Code: string | null;
}
