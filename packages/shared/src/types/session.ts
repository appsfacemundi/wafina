import type { DonorSubtype } from '../enums/donor-subtype';
import type { Role } from '../enums/role';

/**
 * The server-derived identity attached to every authenticated request.
 * Role/Verified always come from the Users sheet, never from the client.
 */
export interface AuthenticatedUser {
  uid: string;
  email: string;
  userId: string;
  role: Role;
  verified: boolean;
  donorSubtype: DonorSubtype | null;
  corporateAccountId: string | null;
  /** False until Name/Phone/Country are filled in (spec 13.1's post-sign-in step). */
  profileComplete: boolean;
}
