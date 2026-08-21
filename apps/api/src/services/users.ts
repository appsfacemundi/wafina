import { randomUUID } from 'node:crypto';
import type {
  AuthenticatedUser,
  DonorSubtype,
  ImpactFeedVisibility,
  RegistrableRole,
  Role,
  SwitchPreference,
  User,
  UserStatus,
} from '@wafina/shared';
import { SHEET_TABS } from '../config/sheet-tabs';
import { nowIso, parseSheetDate, toSheetBool } from '../config/sheet-values';
import { appendRow, findRow, getRows, updateRow } from '../config/sheets';
import { getRegionById, isActiveCountry } from './geo-regions';
import { createNotification } from './notifications';
import { ValidationError } from './validation-error';

/**
 * RC1 RECEBER — permanent per-person identifier (e.g. WF-AO-000184), assigned
 * once at first profile completion for Role==='Donor' only (see completeProfile).
 * Same accepted small-race-window read-then-increment tradeoff as
 * generatePublicDonationCode in services/donations.ts — proportionate to V1's
 * expected write volume.
 */
async function generateWafinaId(countryId: string): Promise<string> {
  const country = await getRegionById(countryId);
  if (!country?.ISO_Code) {
    throw new Error(`Country ${countryId} has no ISO_Code — cannot generate a Wafina ID`);
  }
  const prefix = `WF-${country.ISO_Code}-`;
  const rows = await getRows(SHEET_TABS.users);
  const maxSeq = rows.reduce((max, row) => {
    const id = row.Wafina_ID ?? '';
    if (!id.startsWith(prefix)) return max;
    const num = Number(id.slice(prefix.length));
    return Number.isFinite(num) && num > max ? num : max;
  }, 0);
  return `${prefix}${String(maxSeq + 1).padStart(6, '0')}`;
}

export interface UserRow {
  User_ID: string;
  Name: string;
  Phone: string;
  Role: string;
  Donor_Subtype: string;
  Corporate_Account_ID: string;
  Verified: string;
  Date_Joined: string;
  Email: string;
  Home_Country_ID: string;
  Active_Country_ID: string;
  Switch_Preference: string;
  Show_Name_To_Institutions: string;
  Impact_Feed_Visibility: string;
  Email_Notifications_Enabled: string;
  Status: string;
  /** RC1 RECEBER — assigned once, on first profile completion, only for Role === 'Donor'. See completeProfile. */
  Wafina_ID: string;
  /** Donor loyalty milestones (2026-08-17) — see the shared User type's field comment. */
  Highest_Milestone_Notified: string;
  /** Push notifications prep (2026-08-21) — Expo push token for this device, or '' if never registered/opted out/stale. Internal only, never surfaced via rowToUser. */
  Push_Token: string;
}

function rowToUser(row: UserRow): User {
  return {
    User_ID: row.User_ID,
    Name: row.Name,
    Phone: row.Phone,
    Role: row.Role as Role,
    Donor_Subtype: (row.Donor_Subtype as DonorSubtype) || null,
    Corporate_Account_ID: row.Corporate_Account_ID || null,
    Verified: row.Verified === 'TRUE',
    Email: row.Email,
    Date_Joined: row.Date_Joined,
    Home_Country_ID: row.Home_Country_ID,
    Active_Country_ID: row.Active_Country_ID,
    Switch_Preference: (row.Switch_Preference as SwitchPreference) || 'Always_Ask',
    Show_Name_To_Institutions: row.Show_Name_To_Institutions === 'TRUE',
    Status: (row.Status as UserStatus) || 'Active',
    Wafina_ID: row.Wafina_ID || null,
    Highest_Milestone_Notified: row.Highest_Milestone_Notified ? Number(row.Highest_Milestone_Notified) : null,
  };
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const rows = await getRows(SHEET_TABS.users);
  // RC1 audit fix, 2026-08-10 — trim defensively on both sides: a Sheet row's
  // Email cell can carry stray whitespace from manual entry/legacy import,
  // and normalizeEmail below now trims client input before it ever reaches
  // Firebase, but this guards the lookup itself regardless of either source.
  const target = email.trim().toLowerCase();
  const match = rows.find((row) => row.Email?.trim().toLowerCase() === target);
  return (match as UserRow | undefined) ?? null;
}

/**
 * Bootstraps the minimal Users row a brand-new sign-in needs to exist at all
 * (spec 13: Sign In happens before profile completion). Name/Phone/Home_Country_ID
 * and any Institution profile are filled in later — not here. New Donors default
 * to Donor_Subtype=Individual; joining a corporate account happens afterward via
 * linkCorporateAccount (spec 13.2).
 */
export async function createUser(email: string, role: RegistrableRole): Promise<UserRow> {
  const row: UserRow = {
    User_ID: randomUUID(),
    Name: '',
    Phone: '',
    Role: role,
    Donor_Subtype: role === 'Donor' ? 'Individual' : '',
    Corporate_Account_ID: '',
    // Institutions and Animal Shelters (RC1 RECEBER — same Institutions-sheet
    // verification gate, see requireVerified) stay blocked until Admin
    // verifies them (spec 11.2); Donors need no verification.
    Verified: toSheetBool(role !== 'Institution' && role !== 'Animal_Shelter'),
    Date_Joined: nowIso(),
    Email: email.trim(),
    Home_Country_ID: '',
    Active_Country_ID: '',
    Switch_Preference: 'Always_Ask',
    Show_Name_To_Institutions: toSheetBool(false),
    Impact_Feed_Visibility: 'Private',
    // Opt-out, not opt-in — matches every other notification default in this app (in-app is always on).
    Email_Notifications_Enabled: toSheetBool(true),
    Status: 'Active',
    Wafina_ID: '',
    Highest_Milestone_Notified: '',
    Push_Token: '',
  };

  await appendRow(SHEET_TABS.users, row as unknown as Record<string, string>);
  return row;
}

/** All User_IDs sharing a Corporate_Account_ID — backs the "company-wide" views (spec 4.1, 11.4). */
export async function listUserIdsByCorporateAccount(corporateAccountId: string): Promise<string[]> {
  const rows = await getRows(SHEET_TABS.users);
  return rows
    .filter((row) => row.Corporate_Account_ID === corporateAccountId)
    .map((row) => row.User_ID);
}

export async function findUserById(userId: string): Promise<UserRow | null> {
  const row = await findRow(SHEET_TABS.users, (r) => r.User_ID === userId);
  return (row as UserRow | null) ?? null;
}

export interface ProfileInput {
  Name: string;
  Phone: string;
  /** Phase 3A Module 1 — must reference a real, currently-launched country. */
  Home_Country_ID: string;
}

/**
 * Spec 13.1 — "Sign In → Basic profile → immediate full access." The bootstrap
 * in createUser deliberately left these blank; this is where a brand-new Donor
 * fills them in. Also reused by Settings edits (same endpoint), which matters
 * for one deliberate behavior: Active_Country_ID is seeded from Home_Country_ID
 * only on the very first completion (when Active_Country_ID is still empty).
 * On every later edit — including changing Home_Country_ID itself — Active
 * Country is left untouched, so a user who deliberately switched it while
 * traveling doesn't get silently reset back just by editing their phone number.
 * Only updateActiveCountry (an explicit switch action) ever changes it after that.
 */
export async function completeProfile(userId: string, input: ProfileInput): Promise<ProfileInput> {
  if (!input.Name || !input.Name.trim()) throw new ValidationError('O nome é obrigatório');
  if (!input.Phone || !input.Phone.trim()) throw new ValidationError('O telefone é obrigatório');
  if (!input.Home_Country_ID || !(await isActiveCountry(input.Home_Country_ID))) {
    throw new ValidationError('É necessário indicar um país válido e atualmente suportado');
  }

  const existing = await findUserById(userId);
  const isFirstCompletion = !existing?.Active_Country_ID?.trim();
  const needsWafinaId = isFirstCompletion && existing?.Role === 'Donor' && !existing?.Wafina_ID?.trim();

  await updateRow(SHEET_TABS.users, 'User_ID', userId, {
    Name: input.Name,
    Phone: input.Phone,
    Home_Country_ID: input.Home_Country_ID,
    ...(isFirstCompletion ? { Active_Country_ID: input.Home_Country_ID } : {}),
    ...(needsWafinaId ? { Wafina_ID: await generateWafinaId(input.Home_Country_ID) } : {}),
  });

  return input;
}

/**
 * Phase 3A Module 1 — the only path that changes Active_Country_ID. Always an
 * explicit user action (Settings, or "Switch now" on the GPS prompt); GPS
 * detection alone never reaches this function on its own.
 */
export async function updateActiveCountry(userId: string, countryId: string): Promise<void> {
  if (!(await isActiveCountry(countryId))) {
    throw new ValidationError('País não é atualmente suportado');
  }
  await updateRow(SHEET_TABS.users, 'User_ID', userId, { Active_Country_ID: countryId });
}

/** Governs only whether the switch-country prompt is offered — never triggers a switch itself. */
export async function updateSwitchPreference(userId: string, preference: SwitchPreference): Promise<void> {
  await updateRow(SHEET_TABS.users, 'User_ID', userId, { Switch_Preference: preference });
}

/** Institution UX module — "Donor Name (if donor allows)" on donation cards. Opt-in, defaults FALSE. */
export async function updateShowNameToInstitutions(userId: string, show: boolean): Promise<void> {
  await updateRow(SHEET_TABS.users, 'User_ID', userId, { Show_Name_To_Institutions: toSheetBool(show) });
}

/** Launch-readiness module — which pool of Success Stories the donor's Impact feed draws from. Defaults Private. */
export async function updateImpactFeedVisibility(userId: string, visibility: ImpactFeedVisibility): Promise<void> {
  await updateRow(SHEET_TABS.users, 'User_ID', userId, { Impact_Feed_Visibility: visibility });
}

/**
 * Notification preferences module, 2026-08-08 — governs the email channel only.
 * In-app notifications are never gated by this (always on, per spec). SMS/WhatsApp
 * will get their own separate toggle once that channel is wired up.
 */
export async function updateEmailNotificationsEnabled(userId: string, enabled: boolean): Promise<void> {
  await updateRow(SHEET_TABS.users, 'User_ID', userId, { Email_Notifications_Enabled: toSheetBool(enabled) });
}

/**
 * Push notifications prep (2026-08-21) — registers/clears this device's Expo
 * push token. An empty string explicitly clears it (sign-out, or the OS
 * permission being revoked), so a shared/reused device never keeps receiving
 * a previous user's pushes.
 */
export async function updatePushToken(userId: string, token: string): Promise<void> {
  await updateRow(SHEET_TABS.users, 'User_ID', userId, { Push_Token: token });
}

/**
 * Pilot feedback, 2026-08-05 — Donor's Users.Name gets set during onboarding
 * (OnboardingProfileScreen, spec 13.1), but Institution accounts never had
 * any path to set their own Users.Name at all (see AuthenticatedUser.name's
 * doc comment) — an Institution's Home screen had nowhere to show who's
 * actually signed in, only the org name from the Institutions row. Generic
 * on purpose: any role can call this to set their own display name.
 */
export async function updateUserName(userId: string, name: string): Promise<void> {
  await updateRow(SHEET_TABS.users, 'User_ID', userId, { Name: name });
}

/**
 * Spec 13.2 — joining a company via an Admin-issued invite code. Phase 3A
 * Module 2: existing teammates are looked up *before* the link, so the
 * joining user is never notified about their own arrival, then everyone who
 * was already on the account gets a "corporate_member_joined" notification.
 */
export async function linkCorporateAccount(userId: string, corporateAccountId: string): Promise<void> {
  const [existingTeammateIds, joiningUser] = await Promise.all([
    listUserIdsByCorporateAccount(corporateAccountId),
    findUserById(userId),
  ]);

  await updateRow(SHEET_TABS.users, 'User_ID', userId, {
    Donor_Subtype: 'Corporate',
    Corporate_Account_ID: corporateAccountId,
  });

  const joinerName = joiningUser?.Name?.trim() || 'Um novo membro';
  await Promise.all(
    existingTeammateIds.map((teammateId) =>
      createNotification({
        recipientUserId: teammateId,
        notificationType: 'corporate_member_joined',
        entityType: 'Corporate_Account',
        entityId: corporateAccountId,
        message: `${joinerName} associou-se à sua conta corporativa.`,
      }),
    ),
  );
}

/**
 * Admin parity Phase A — the full user list for Admin's Users page, newest
 * first. 2026-08-08: legacy AppSheet-era rows only have day precision on
 * Date_Joined, so several users who joined the same calendar day tie exactly
 * — same root cause as sequenceSuffix's doc comment in sheet-values.ts.
 * Users have no equivalent incrementing sequence, so Name is the best
 * available deterministic (if not truly chronological) tiebreak.
 */
export async function listAllUsers(): Promise<User[]> {
  const rows = await getRows(SHEET_TABS.users);
  return rows
    .map((row) => rowToUser(row as unknown as UserRow))
    .sort(
      (a, b) => parseSheetDate(b.Date_Joined) - parseSheetDate(a.Date_Joined) || a.Name.localeCompare(b.Name, 'pt'),
    );
}

async function getUserOrThrow(userId: string): Promise<UserRow> {
  const row = await findRow(SHEET_TABS.users, (r) => r.User_ID === userId);
  if (!row) throw new ValidationError('Utilizador não encontrado');
  return row as unknown as UserRow;
}

/** Blocks the account at requireAuth (Status is re-checked on every request) without deleting any data. */
export async function suspendUser(userId: string): Promise<User> {
  await getUserOrThrow(userId);
  await updateRow(SHEET_TABS.users, 'User_ID', userId, { Status: 'Suspended' satisfies UserStatus });
  return rowToUser(await getUserOrThrow(userId));
}

export async function reactivateUser(userId: string): Promise<User> {
  await getUserOrThrow(userId);
  await updateRow(SHEET_TABS.users, 'User_ID', userId, { Status: 'Active' satisfies UserStatus });
  return rowToUser(await getUserOrThrow(userId));
}

/**
 * RC1 self-service donor account deletion. The row itself stays (Donations/Success_Stories
 * reference it only by Donor_ID, never by name/contact), but every identifying field — including
 * Email — is cleared and Show_Name_To_Institutions is forced off — the same consent flag
 * donation/story display already respects everywhere, so past donations correctly render as
 * anonymous with no other code changes needed. Status: 'Deleted' locks the account out
 * immediately via requireAuth. Email must be cleared, not just Name/Phone: findUserByEmail (used
 * by /auth/session on every login/registration) matches on this field alone, so leaving the old
 * address in place would make a genuine future re-registration with that same email collide with
 * this dead row and get permanently rejected by the Status check instead of creating a fresh one.
 * Institution accounts are deliberately out of scope — see COMPLIANCE_INFORMATION.md.
 */
export async function deleteDonorAccount(userId: string): Promise<void> {
  await getUserOrThrow(userId);
  await updateRow(SHEET_TABS.users, 'User_ID', userId, {
    Name: '',
    Phone: '',
    Email: '',
    Corporate_Account_ID: '',
    Show_Name_To_Institutions: toSheetBool(false),
    Status: 'Deleted' satisfies UserStatus,
  });
}

/**
 * Deliberately restricted to Donor <-> Institution: this is Admin correcting a
 * mis-registered account, not a privilege-escalation lever. Granting Admin
 * access is never done through this endpoint.
 */
export async function setUserRole(userId: string, role: RegistrableRole): Promise<User> {
  await getUserOrThrow(userId);
  await updateRow(SHEET_TABS.users, 'User_ID', userId, { Role: role });
  return rowToUser(await getUserOrThrow(userId));
}

/** Shared by the auth middleware and /auth/session so both build the same session shape. */
export function toAuthenticatedUser(uid: string, row: UserRow): AuthenticatedUser {
  return {
    uid,
    email: row.Email,
    userId: row.User_ID,
    name: row.Name?.trim() || null,
    role: row.Role as Role,
    verified: row.Verified === 'TRUE',
    donorSubtype: (row.Donor_Subtype as DonorSubtype) || null,
    corporateAccountId: row.Corporate_Account_ID || null,
    profileComplete: Boolean(row.Name?.trim() && row.Phone?.trim() && row.Home_Country_ID?.trim()),
    homeCountryId: row.Home_Country_ID || null,
    activeCountryId: row.Active_Country_ID || null,
    wafinaId: row.Wafina_ID || null,
    switchPreference: (row.Switch_Preference as SwitchPreference) || null,
    showNameToInstitutions: row.Show_Name_To_Institutions === 'TRUE',
    impactFeedVisibility: (row.Impact_Feed_Visibility as ImpactFeedVisibility) || 'Private',
    // Existing rows predate this column — an empty cell must mean "on" (the default), not "off".
    emailNotificationsEnabled: row.Email_Notifications_Enabled !== 'FALSE',
  };
}
