import type { DonorSubtype } from '../enums/donor-subtype';
import type { Role } from '../enums/role';
import type { SwitchPreference } from '../enums/switch-preference';

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
  /** False until Name/Phone/Home_Country_ID are filled in (spec 13.1's post-sign-in step). */
  profileComplete: boolean;
  /** Null only before profile completion. Drives which institutions/donations/reports are visible. */
  activeCountryId: string | null;
  homeCountryId: string | null;
  switchPreference: SwitchPreference | null;
  /** "Donor Name (if donor allows)" on donation cards — irrelevant/ignored for Corporate donors. */
  showNameToInstitutions: boolean;
}
