import { randomBytes } from 'node:crypto';
import type { InvitationCode } from '@wafina/shared';
import { SHEET_TABS } from '../config/sheet-tabs';
import { fromSheetBool, nowIso, parseSheetDate, toSheetBool } from '../config/sheet-values';
import { appendRow, findRow, getRows, updateRow } from '../config/sheets';
import { getCorporateAccountById } from './corporate-accounts';
import { EMAIL_BRAND_COLOR, EMAIL_LOGO_HTML, sendEmail } from './email';
import { ValidationError } from './validation-error';

/** Matches donor-tiers.ts's own local EmailLocale — no stored per-user language preference exists yet; every call site passes the same RC1 default of 'pt'. */
type EmailLocale = 'pt' | 'en';

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
    Invited_Email: row.Invited_Email || null,
  };
}

/** Admin generates a code for a company — single-use when maxUses is 1, multi-use for any higher number. */
export async function createInvitationCode(
  corporateAccountId: string,
  maxUses: number,
  expiresAt: string | null,
): Promise<InvitationCode> {
  if (!Number.isInteger(maxUses) || maxUses < 1) {
    throw new ValidationError('O número máximo de utilizações deve ser um número inteiro positivo');
  }

  const row = {
    Code: generateCode(),
    Corporate_Account_ID: corporateAccountId,
    Max_Uses: String(maxUses),
    Uses_Count: '0',
    Expires_At: expiresAt ?? '',
    Date_Created: nowIso(),
    Active: toSheetBool(true),
    Invited_Email: '',
  };
  await appendRow(SHEET_TABS.invitationCodes, row);
  return rowToInvitationCode(row);
}

/**
 * Corporate secure invitations (V2, 2026-08-17) — self-contained try/catch,
 * same philosophy as sendMilestoneEmail (donor-tiers.ts): never throws, so a
 * missing/misconfigured email provider can never turn a successful
 * invitation creation into a failure.
 */
async function sendInvitationEmail(
  email: string,
  companyName: string,
  code: string,
  locale: EmailLocale = 'pt',
): Promise<void> {
  try {
    const copy: Record<EmailLocale, { subject: string; heading: string; body1: string; body2: string; footer: string }> = {
      pt: {
        subject: `Wafina — Convite de ${companyName}`,
        heading: `${companyName} convidou-o(a) para a Wafina! 🎉`,
        body1: `Use o código abaixo na app Wafina, em <strong>Definições → Conta corporativa</strong>, para associar a sua conta a <strong>${companyName}</strong>.`,
        body2: 'Este código é pessoal e só pode ser usado uma vez.',
        footer: 'Recebeu este email porque a sua empresa o convidou a juntar-se à Wafina.',
      },
      en: {
        subject: `Wafina — Invitation from ${companyName}`,
        heading: `${companyName} invited you to Wafina! 🎉`,
        body1: `Use the code below in the Wafina app, under <strong>Settings → Company account</strong>, to link your account to <strong>${companyName}</strong>.`,
        body2: 'This code is personal and can only be used once.',
        footer: 'You received this email because your company invited you to join Wafina.',
      },
    };
    const c = copy[locale];
    await sendEmail({
      to: email,
      subject: c.subject,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          ${EMAIL_LOGO_HTML}
          <h2 style="color: ${EMAIL_BRAND_COLOR};">${c.heading}</h2>
          <p style="color: #475569; line-height: 1.5;">${c.body1}</p>
          <p style="text-align: center; font-family: monospace; font-size: 28px; font-weight: 700; letter-spacing: 4px; color: ${EMAIL_BRAND_COLOR}; background: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0;">${code}</p>
          <p style="color: #475569; line-height: 1.5;">${c.body2}</p>
          <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">${c.footer}</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('sendInvitationEmail failed (swallowed, does not fail the caller\'s action):', err);
  }
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Corporate secure invitations (V2, 2026-08-17) — Admin targets one specific
 * person's email instead of generating an anonymous shareable code. Always
 * single-use (Max_Uses: 1) and locked to that email at redemption time (see
 * redeemInvitationCode) — the whole point is that this code can't be
 * forwarded and reused by someone else.
 */
export async function createAndSendInvitation(corporateAccountId: string, email: string): Promise<InvitationCode> {
  const trimmedEmail = email?.trim();
  if (!trimmedEmail || !trimmedEmail.includes('@')) {
    throw new ValidationError('Indique um endereço de email válido');
  }

  const account = await getCorporateAccountById(corporateAccountId);
  if (!account) throw new ValidationError('Conta empresarial não encontrada');
  if (account.Status === 'Suspended') {
    throw new ValidationError('Esta empresa está suspensa e não pode convidar novos membros');
  }

  const row = {
    Code: generateCode(),
    Corporate_Account_ID: corporateAccountId,
    Max_Uses: '1',
    Uses_Count: '0',
    Expires_At: new Date(Date.now() + THIRTY_DAYS_MS).toISOString(),
    Date_Created: nowIso(),
    Active: toSheetBool(true),
    Invited_Email: trimmedEmail,
  };
  await appendRow(SHEET_TABS.invitationCodes, row);
  await sendInvitationEmail(trimmedEmail, account.Company_Name, row.Code);
  return rowToInvitationCode(row);
}

export async function listCodesForAccount(corporateAccountId: string): Promise<InvitationCode[]> {
  const rows = await getRows(SHEET_TABS.invitationCodes);
  return rows
    .filter((row) => row.Corporate_Account_ID === corporateAccountId)
    .map(rowToInvitationCode)
    .sort((a, b) => parseSheetDate(b.Date_Created) - parseSheetDate(a.Date_Created));
}

export async function deactivateCode(code: string): Promise<void> {
  const row = await findRow(SHEET_TABS.invitationCodes, (r) => r.Code === code);
  if (!row) throw new ValidationError('Código não encontrado');
  await updateRow(SHEET_TABS.invitationCodes, 'Code', code, { Active: toSheetBool(false) });
}

/**
 * Donor-facing "join a company" redeem. Validates the code is Active, not
 * expired, under its usage limit, and that the company itself isn't
 * suspended — all *before* incrementing Uses_Count, so a rejected join never
 * silently consumes one of the code's limited uses.
 *
 * Corporate secure invitations (V2, 2026-08-17) — `redeemerEmail` is the
 * caller's own authenticated session email (never client-supplied). When
 * the code carries an Invited_Email, only that exact address may redeem it —
 * the security property a plain shareable code never had.
 */
export async function redeemInvitationCode(code: string, redeemerEmail: string): Promise<string> {
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
  if (invitation.Invited_Email && invitation.Invited_Email.toLowerCase() !== redeemerEmail.trim().toLowerCase()) {
    throw new ValidationError('Este convite foi enviado para outro endereço de email.');
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
