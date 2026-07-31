import { randomUUID } from 'node:crypto';
import type { AdminCorporateAccountView, CorporateAccount, UserStatus } from '@wafina/shared';
import { SHEET_TABS } from '../config/sheet-tabs';
import { nowIso } from '../config/sheet-values';
import { appendRow, findRow, getRows, updateRow } from '../config/sheets';
import { listUserIdsByCorporateAccount } from './users';
import { ValidationError } from './validation-error';

function rowToCorporateAccount(row: Record<string, string>): CorporateAccount {
  return {
    Corporate_Account_ID: row.Corporate_Account_ID,
    Company_Name: row.Company_Name,
    Country: row.Country,
    Date_Created: row.Date_Created,
    Status: (row.Status as UserStatus) || 'Active',
    Logo: row.Logo || null,
  };
}

export async function getCorporateAccountById(id: string): Promise<CorporateAccount | null> {
  const row = await findRow(SHEET_TABS.corporateAccounts, (r) => r.Corporate_Account_ID === id);
  return row ? rowToCorporateAccount(row) : null;
}

/**
 * Admin Web App Parity Phase B — previously "Creation stays Admin-only via
 * AppSheet"; that's stale now that AppSheet is retired from the architecture.
 * Invite codes are now their own entity (see invitation-codes.ts) rather than
 * the Corporate_Account_ID itself, so this no longer needs to double as one.
 */
export async function createCorporateAccount(companyName: string, country: string): Promise<CorporateAccount> {
  if (!companyName.trim()) throw new ValidationError('Company name is required');
  if (!country.trim()) throw new ValidationError('Country is required');

  const row = {
    Corporate_Account_ID: randomUUID(),
    Company_Name: companyName.trim(),
    Country: country.trim(),
    Date_Created: nowIso(),
    Status: 'Active' satisfies UserStatus,
    Logo: '',
  };
  await appendRow(SHEET_TABS.corporateAccounts, row);
  return rowToCorporateAccount(row);
}

async function getCorporateAccountOrThrow(id: string): Promise<CorporateAccount> {
  const account = await getCorporateAccountById(id);
  if (!account) throw new ValidationError('Corporate account not found');
  return account;
}

export async function updateCorporateAccount(
  id: string,
  patch: { Company_Name?: string; Country?: string; Logo?: string },
): Promise<CorporateAccount> {
  await getCorporateAccountOrThrow(id);
  const fields: Record<string, string> = {};
  if (patch.Company_Name !== undefined) {
    if (!patch.Company_Name.trim()) throw new ValidationError('Company name cannot be empty');
    fields.Company_Name = patch.Company_Name.trim();
  }
  if (patch.Country !== undefined) {
    if (!patch.Country.trim()) throw new ValidationError('Country cannot be empty');
    fields.Country = patch.Country.trim();
  }
  if (patch.Logo !== undefined) fields.Logo = patch.Logo;

  await updateRow(SHEET_TABS.corporateAccounts, 'Corporate_Account_ID', id, fields);
  return getCorporateAccountOrThrow(id);
}

export async function suspendCorporateAccount(id: string): Promise<CorporateAccount> {
  await getCorporateAccountOrThrow(id);
  await updateRow(SHEET_TABS.corporateAccounts, 'Corporate_Account_ID', id, {
    Status: 'Suspended' satisfies UserStatus,
  });
  return getCorporateAccountOrThrow(id);
}

export async function reactivateCorporateAccount(id: string): Promise<CorporateAccount> {
  await getCorporateAccountOrThrow(id);
  await updateRow(SHEET_TABS.corporateAccounts, 'Corporate_Account_ID', id, {
    Status: 'Active' satisfies UserStatus,
  });
  return getCorporateAccountOrThrow(id);
}

/** Admin's Companies page — every company plus the counts Admin needs to manage it. */
export async function listAllCorporateAccounts(): Promise<AdminCorporateAccountView[]> {
  const [accountRows, donationRows] = await Promise.all([
    getRows(SHEET_TABS.corporateAccounts),
    getRows(SHEET_TABS.donations),
  ]);

  return Promise.all(
    accountRows.map(async (row) => {
      const account = rowToCorporateAccount(row);
      const employeeIds = await listUserIdsByCorporateAccount(account.Corporate_Account_ID);
      const employeeIdSet = new Set(employeeIds);
      const donationCount = donationRows.filter((d) => employeeIdSet.has(d.Donor_ID)).length;
      return { ...account, Employee_Count: employeeIds.length, Donation_Count: donationCount };
    }),
  );
}
