import type { CorporateAccount } from '@wafina/shared';
import { SHEET_TABS } from '../config/sheet-tabs';
import { findRow } from '../config/sheets';

function rowToCorporateAccount(row: Record<string, string>): CorporateAccount {
  return {
    Corporate_Account_ID: row.Corporate_Account_ID,
    Company_Name: row.Company_Name,
    Country: row.Country,
    Date_Created: row.Date_Created,
    Logo: row.Logo || null,
  };
}

/**
 * Creation stays Admin-only via AppSheet (spec 11.6.2) — Admin provisions the
 * account after a confirmed partnership. Spec 5.2 defines no separate
 * Invite_Code column, so this treats the Corporate_Account_ID itself as the
 * code Admin hands to new team members. Flagging this reading for confirmation
 * rather than inventing an extra column not in the documented schema.
 */
export async function findCorporateAccountByInviteCode(
  code: string,
): Promise<CorporateAccount | null> {
  const row = await findRow(
    SHEET_TABS.corporateAccounts,
    (r) => r.Corporate_Account_ID === code,
  );
  return row ? rowToCorporateAccount(row) : null;
}
