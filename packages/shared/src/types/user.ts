import type { Role } from '../enums/role';
import type { DonorSubtype } from '../enums/donor-subtype';

export interface User {
  User_ID: string;
  Name: string;
  Phone: string;
  Country: string;
  Role: Role;
  /** Only set when Role === 'Donor'. */
  Donor_Subtype: DonorSubtype | null;
  /** Only set when Donor_Subtype === 'Corporate'. */
  Corporate_Account_ID: string | null;
  Verified: boolean;
  Email: string;
  Date_Joined: string;
}
