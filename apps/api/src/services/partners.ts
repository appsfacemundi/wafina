import { randomUUID } from 'node:crypto';
import type { Partner } from '@wafina/shared';
import { toProxiedUrl } from '../config/photo-storage';
import { SHEET_TABS } from '../config/sheet-tabs';
import { fromSheetBool, nowIso, toSheetBool } from '../config/sheet-values';
import { appendRow, findRow, getRows, updateRow } from '../config/sheets';
import { ValidationError } from './validation-error';

const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 600;

function rowToPartner(row: Record<string, string>): Partner {
  return {
    Partner_ID: row.Partner_ID,
    Name: row.Name,
    Logo: toProxiedUrl(row.Logo) ?? '',
    Description: row.Description,
    Website: row.Website || null,
    Active: fromSheetBool(row.Active ?? ''),
    Display_Order: Number(row.Display_Order) || 0,
    Date_Added: row.Date_Added,
  };
}

function byDisplayOrder(a: Partner, b: Partner): number {
  if (a.Display_Order !== b.Display_Order) return a.Display_Order - b.Display_Order;
  return a.Name.localeCompare(b.Name, 'pt');
}

/** Donor Home "Os Nossos Parceiros" grid — Active only, curated order. */
export async function listActivePartners(): Promise<Partner[]> {
  const rows = await getRows(SHEET_TABS.partners);
  return rows
    .filter((row) => fromSheetBool(row.Active ?? ''))
    .map(rowToPartner)
    .sort(byDisplayOrder);
}

/** Admin management list — every partner regardless of status. */
export async function listAllPartners(): Promise<Partner[]> {
  const rows = await getRows(SHEET_TABS.partners);
  return rows.map(rowToPartner).sort(byDisplayOrder);
}

async function getPartnerOrThrow(partnerId: string): Promise<Partner> {
  const row = await findRow(SHEET_TABS.partners, (r) => r.Partner_ID === partnerId);
  if (!row) throw new ValidationError('Parceiro não encontrado');
  return rowToPartner(row);
}

export interface CreatePartnerInput {
  Name: string;
  Description: string;
  Logo: string;
  Website?: string;
}

/** Admin-only — new partners start Active so they show up immediately; pause them via setPartnerActive instead. */
export async function createPartner(input: CreatePartnerInput): Promise<Partner> {
  if (!input.Name || !input.Name.trim()) throw new ValidationError('O nome é obrigatório');
  if (input.Name.length > MAX_NAME_LENGTH) {
    throw new ValidationError(`O nome não pode exceder ${MAX_NAME_LENGTH} caracteres`);
  }
  if (!input.Description || !input.Description.trim()) {
    throw new ValidationError('A descrição é obrigatória');
  }
  if (input.Description.length > MAX_DESCRIPTION_LENGTH) {
    throw new ValidationError(`A descrição não pode exceder ${MAX_DESCRIPTION_LENGTH} caracteres`);
  }
  if (!input.Logo) throw new ValidationError('O logótipo é obrigatório');

  const existing = await getRows(SHEET_TABS.partners);
  const maxOrder = existing.reduce((max, row) => Math.max(max, Number(row.Display_Order) || 0), 0);

  const row = {
    Partner_ID: randomUUID(),
    Name: input.Name.trim(),
    Logo: input.Logo,
    Description: input.Description.trim(),
    Website: input.Website?.trim() || '',
    Active: toSheetBool(true),
    Display_Order: String(maxOrder + 1),
    Date_Added: nowIso(),
  };

  await appendRow(SHEET_TABS.partners, row);
  return rowToPartner(row);
}

export interface UpdatePartnerInput {
  Name?: string;
  Description?: string;
  Website?: string;
  Logo?: string;
  Display_Order?: number;
}

/** Admin-only — edits any subset of fields; a new Logo (re-upload) is optional, same "replace anytime" pattern as donation photos. */
export async function updatePartner(partnerId: string, input: UpdatePartnerInput): Promise<Partner> {
  await getPartnerOrThrow(partnerId);

  if (input.Name !== undefined && !input.Name.trim()) {
    throw new ValidationError('O nome é obrigatório');
  }
  if (input.Description !== undefined && !input.Description.trim()) {
    throw new ValidationError('A descrição é obrigatória');
  }

  const patch: Record<string, string> = {};
  if (input.Name !== undefined) patch.Name = input.Name.trim();
  if (input.Description !== undefined) patch.Description = input.Description.trim();
  if (input.Website !== undefined) patch.Website = input.Website.trim();
  if (input.Logo !== undefined) patch.Logo = input.Logo;
  if (input.Display_Order !== undefined) patch.Display_Order = String(input.Display_Order);

  await updateRow(SHEET_TABS.partners, 'Partner_ID', partnerId, patch);
  return getPartnerOrThrow(partnerId);
}

/** Pause/resume a partner without losing its profile data — same lever as GeoRegion.Active. */
export async function setPartnerActive(partnerId: string, active: boolean): Promise<Partner> {
  await getPartnerOrThrow(partnerId);
  await updateRow(SHEET_TABS.partners, 'Partner_ID', partnerId, { Active: toSheetBool(active) });
  return getPartnerOrThrow(partnerId);
}
