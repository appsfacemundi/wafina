import type { UserStatus } from '../enums/user-status';

export interface CorporateAccount {
  Corporate_Account_ID: string;
  Company_Name: string;
  Country: string;
  Date_Created: string;
  /** Admin Web App Parity Phase B — reuses the same Active/Suspended vocabulary as Users. */
  Status: UserStatus;
  /**
   * Institution UX module (2026-07-30) — shown on donation cards for
   * corporate donations ("Donor Logo (for companies)"). Schema/display-ready;
   * no upload UI yet since Corporate_Accounts are Admin-provisioned, not
   * self-service (spec 11.4.2) — setting this is a future Admin action, not
   * scoped into this module. Null is the common case today, always handled.
   */
  Logo: string | null;
}

/** Admin's Companies page — same account plus the counts Admin needs to manage it. */
export interface AdminCorporateAccountView extends CorporateAccount {
  Employee_Count: number;
  Donation_Count: number;
}
