import { randomBytes } from 'node:crypto';
import type { InvitationCode } from '@wafina/shared';
import { SHEET_TABS } from '../config/sheet-tabs';
import { nowIso, toSheetBool, fromSheetBool } from '../config/sheet-values';
import { appendRow, findRow, getRows, updateRow } from '../config/sheets';
import { getCorporateAccountById } from './corporate-accounts';
import { ValidationError } from './validation-error';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I — avoids look-alike mistakes when typed by hand

function generateCode(): string {
  const bytes = randomBytes(8);
  let code = '';
  for (const byte of bytes) {
    code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  }
  return code;
}

function rowToInvitationCode(row: Record<string, string>): InvitationCode {
  return {
    Code: row.Code,
    Corporate_Account_ID: row.Corporate_Account_ID,
    Max_Uses: Number(row.Max_Uses) || 1,
    Uses_Count: Number(row.Uses_Count) || 0,
    Expires_At: row.Expires_At || null,
    Date_Created: row.Date_Created,
    Active: fromSheetBool(row.Active ?? ''),
  };
}

/** Admin generates a code for a company — single-use when maxUses is 1, multi-use for any higher number. */
export async function createInvitationCode(
  corporateAccountId: string,
  maxUses: number,
  expiresAt: string | null,
): Promise<InvitationCode> {
  if (!Number.isInteger(maxUses) || maxUses < 1) {
    throw new ValidationError('Max uses must be a positive integer');
  }

  const row = {
    Code: generateCode(),
    Corporate_Account_ID: corporateAccountId,
    Max_Uses: String(maxUses),
    Uses_Count: '0',
    Expires_At: expiresAt ?? '',
    Date_Created: nowIso(),
    Active: toSheetBool(true),
  };
  await appendRow(SHEET_TABS.invitationCodes, row);
  return rowToInvitationCode(row);
}

export async function listCodesForAccount(corporateAccountId: string): Promise<InvitationCode[]> {
  const rows = await getRows(SHEET_TABS.invitationCodes);
  return rows
    .filter((row) => row.Corporate_Account_ID === corporateAccountId)
    .map(rowToInvitationCode)
    .sort((a, b) => b.Date_Created.localeCompare(a.Date_Created));
}

export async function deactivateCode(code: string): Promise<void> {
  const row = await findRow(SHEET_TABS.invitationCodes, (r) => r.Code === code);
  if (!row) throw new ValidationError('Code not found');
  await updateRow(SHEET_TABS.invitationCodes, 'Code', code, { Active: toSheetBool(false) });
}

/**
 * Donor-facing "join a company" redeem. Validates the code is Active, not
 * expired, under its usage limit, and that the company itself isn't
 * suspended — all *before* incrementing Uses_Count, so a rejected join never
 * silently consumes one of the code's limited uses.
 */
export async function redeemInvitationCode(code: string): Promise<string> {
  const row = await findRow(SHEET_TABS.invitationCodes, (r) => r.Code === code.trim().toUpperCase());
  if (!row) throw new ValidationError('Código de convite inválido.');

  const invitation = rowToInvitationCode(row);
  if (!invitation.Active) throw new ValidationError('Este código de convite já não está ativo.');
  if (invitation.Expires_At && new Date(invitation.Expires_At).getTime() < Date.now()) {
    throw new ValidationError('Este código de convite expirou.');
  }
  if (invitation.Uses_Count >= invitation.Max_Uses) {
    throw new ValidationError('Este código de convite já atingiu o limite de utilizações.');
  }

  const account = await getCorporateAccountById(invitation.Corporate_Account_ID);
  if (!account || account.Status === 'Suspended') {
    throw new ValidationError('Esta empresa não está de momento a aceitar novos membros.');
  }

  await updateRow(SHEET_TABS.invitationCodes, 'Code', invitation.Code, {
    Uses_Count: String(invitation.Uses_Count + 1),
  });

  return invitation.Corporate_Account_ID;
}
