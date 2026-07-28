import { randomUUID } from 'node:crypto';
import type { AuthenticatedUser, DonorSubtype, RegistrableRole, Role } from '@wafina/shared';
import { SHEET_TABS } from '../config/sheet-tabs';
import { nowIso, toSheetBool } from '../config/sheet-values';
import { appendRow, findRow, getRows, updateRow } from '../config/sheets';
import { ValidationError } from './validation-error';

export interface UserRow {
  User_ID: string;
  Name: string;
  Phone: string;
  Country: string;
  Role: string;
  Donor_Subtype: string;
  Corporate_Account_ID: string;
  Verified: string;
  Date_Joined: string;
  Email: string;
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const rows = await getRows(SHEET_TABS.users);
  const match = rows.find((row) => row.Email?.toLowerCase() === email.toLowerCase());
  return (match as UserRow | undefined) ?? null;
}

/**
 * Bootstraps the minimal Users row a brand-new sign-in needs to exist at all
 * (spec 13: Sign In happens before profile completion). Name/Phone/Country
 * and any Institution profile are filled in later by Modules 4/5 — not here.
 * New Donors default to Donor_Subtype=Individual; joining a corporate account
 * happens afterward via linkCorporateAccount (spec 13.2).
 */
export async function createUser(email: string, role: RegistrableRole): Promise<UserRow> {
  const row: UserRow = {
    User_ID: randomUUID(),
    Name: '',
    Phone: '',
    Country: '',
    Role: role,
    Donor_Subtype: role === 'Donor' ? 'Individual' : '',
    Corporate_Account_ID: '',
    // Institutions stay blocked until Admin verifies them (spec 11.2); Donors need no verification.
    Verified: toSheetBool(role !== 'Institution'),
    Date_Joined: nowIso(),
    Email: email,
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
  Country: string;
}

/**
 * Spec 13.1 — "Sign In → Basic profile → immediate full access." Module 2's
 * bootstrap deliberately left these blank; this is where a brand-new Donor
 * fills them in.
 */
export async function completeProfile(userId: string, input: ProfileInput): Promise<ProfileInput> {
  if (!input.Name || !input.Name.trim()) throw new ValidationError('Name is required');
  if (!input.Phone || !input.Phone.trim()) throw new ValidationError('Phone is required');
  if (!input.Country || !input.Country.trim()) throw new ValidationError('Country is required');

  await updateRow(SHEET_TABS.users, 'User_ID', userId, {
    Name: input.Name,
    Phone: input.Phone,
    Country: input.Country,
  });

  return input;
}

/** Spec 13.2 — joining a company via an Admin-issued invite code. */
export async function linkCorporateAccount(userId: string, corporateAccountId: string): Promise<void> {
  await updateRow(SHEET_TABS.users, 'User_ID', userId, {
    Donor_Subtype: 'Corporate',
    Corporate_Account_ID: corporateAccountId,
  });
}

/** Shared by the auth middleware and /auth/session so both build the same session shape. */
export function toAuthenticatedUser(uid: string, row: UserRow): AuthenticatedUser {
  return {
    uid,
    email: row.Email,
    userId: row.User_ID,
    role: row.Role as Role,
    verified: row.Verified === 'TRUE',
    donorSubtype: (row.Donor_Subtype as DonorSubtype) || null,
    corporateAccountId: row.Corporate_Account_ID || null,
    profileComplete: Boolean(row.Name?.trim() && row.Phone?.trim() && row.Country?.trim()),
  };
}
