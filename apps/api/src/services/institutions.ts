import { randomUUID } from 'node:crypto';
import type { Institution } from '@wafina/shared';
import { SHEET_TABS } from '../config/sheet-tabs';
import { fromSheetBool, fromSheetLatLong, toSheetBool, toSheetLatLong } from '../config/sheet-values';
import { appendRow, findRow, getRows, updateRow } from '../config/sheets';
import { isActiveCountry } from './geo-regions';
import { sumDeliveredQuantityForInstitution } from './donations';
import { createNotification } from './notifications';
import { ValidationError } from './validation-error';

const MIN_NAME_LENGTH = 2;

/**
 * All profile fields lock automatically on verification (spec 4.2.4). Real
 * per-field unlocking only happens when Admin grants a temporary exception
 * during a Change Request (spec 11.5) — if the live sheet has a Locked_Fields
 * column reflecting that, we honor it; otherwise fall back to this all-or-
 * nothing default, since the column doesn't exist there yet (spec 5.2 gap).
 */
const ALL_PROFILE_FIELDS = ['Name', 'Type', 'Location', 'Needs_List', 'Logo'];

async function rowToInstitution(row: Record<string, string>): Promise<Institution> {
  const verified = fromSheetBool(row.Verified ?? '');
  const lockedFields = row.Locked_Fields
    ? row.Locked_Fields.split(',')
        .map((f) => f.trim())
        .filter(Boolean)
    : verified
      ? ALL_PROFILE_FIELDS
      : [];

  return {
    Institution_ID: row.Institution_ID,
    User_ID: row.User_ID,
    Name: row.Name,
    Logo: row.Logo || null,
    Type: row.Type,
    Location: fromSheetLatLong(row.Location ?? '') ?? { lat: 0, lng: 0 },
    Needs_List: row.Needs_List || null,
    Verified: verified,
    Rejection_Reason: row.Rejection_Reason || null,
    Total_Items_Received: await sumDeliveredQuantityForInstitution(row.Institution_ID),
    Locked_Fields: lockedFields,
    Country_ID: row.Country_ID,
    Region_ID: row.Region_ID || null,
    Service_Radius_Km: row.Service_Radius_Km ? Number(row.Service_Radius_Km) : null,
    Coverage_Area: row.Coverage_Area || null,
  };
}

export interface CreateInstitutionInput {
  Name: string;
  Type: string;
  Location: { lat: number; lng: number };
  Needs_List?: string;
  /** Phase 3A Module 1 — the institution's actual operating country, required. */
  Country_ID: string;
  /** Province/Municipality/District, optional until that depth of data exists. */
  Region_ID?: string;
  Service_Radius_Km?: number;
  Coverage_Area?: string;
}

/**
 * Institution registration (spec 13.3). Always creates Verified=FALSE — there
 * is deliberately no update function in this service: once verified, fields
 * lock automatically, and the only path to changing them is a Change Request
 * that Admin acts on in AppSheet (spec 4.2.4, 11.5). Enforcing the lock by
 * never exposing a write path is simpler and more robust than checking a flag.
 */
export async function createInstitution(
  userId: string,
  input: CreateInstitutionInput,
): Promise<Institution> {
  if (!input.Name || input.Name.trim().length < MIN_NAME_LENGTH) {
    throw new ValidationError(`Name must be at least ${MIN_NAME_LENGTH} characters`);
  }
  if (!input.Type) throw new ValidationError('Type is required');
  if (
    !Number.isFinite(input.Location?.lat) ||
    !Number.isFinite(input.Location?.lng) ||
    (input.Location.lat === 0 && input.Location.lng === 0)
  ) {
    throw new ValidationError('Location must be a valid, non-zero coordinate pair');
  }
  if (!input.Country_ID || !(await isActiveCountry(input.Country_ID))) {
    throw new ValidationError('A valid, currently-supported country is required');
  }
  if (
    input.Service_Radius_Km !== undefined &&
    (!Number.isFinite(input.Service_Radius_Km) || input.Service_Radius_Km <= 0)
  ) {
    throw new ValidationError('Service_Radius_Km must be a positive number');
  }

  const existing = await findRow(SHEET_TABS.institutions, (r) => r.User_ID === userId);
  if (existing) {
    throw new ValidationError('This user already has an Institution profile');
  }

  const row = {
    Institution_ID: randomUUID(),
    User_ID: userId,
    Name: input.Name,
    Type: input.Type,
    Location: toSheetLatLong(input.Location),
    Verified: toSheetBool(false),
    Needs_List: input.Needs_List ?? '',
    Logo: '',
    Rejection_Reason: '',
    Country_ID: input.Country_ID,
    Region_ID: input.Region_ID ?? '',
    Service_Radius_Km: input.Service_Radius_Km !== undefined ? String(input.Service_Radius_Km) : '',
    Coverage_Area: input.Coverage_Area ?? '',
  };

  await appendRow(SHEET_TABS.institutions, row);
  return rowToInstitution(row);
}

export async function getInstitutionByUserId(userId: string): Promise<Institution | null> {
  const row = await findRow(SHEET_TABS.institutions, (r) => r.User_ID === userId);
  return row ? rowToInstitution(row) : null;
}

export async function getInstitutionById(institutionId: string): Promise<Institution | null> {
  const row = await findRow(SHEET_TABS.institutions, (r) => r.Institution_ID === institutionId);
  return row ? rowToInstitution(row) : null;
}

/**
 * Donor-facing read-only browse (spec 3.2, 4.1). Phase 3A Module 1: scoped to
 * the donor's Active Country by default — this is the "which institutions are
 * visible" rule the Active Country concept exists to enforce. Passing no
 * countryId returns every verified institution worldwide, which no route uses
 * today but is kept available for a future explicit "browse all countries" view.
 */
export async function listVerifiedInstitutions(countryId?: string): Promise<Institution[]> {
  const rows = await getRows(SHEET_TABS.institutions);
  const verifiedRows = rows.filter(
    (row) => fromSheetBool(row.Verified ?? '') && (!countryId || row.Country_ID === countryId),
  );
  return Promise.all(verifiedRows.map(rowToInstitution));
}

/** Admin Web App foundation — institutions awaiting verification (spec 11.2). */
export async function listPendingInstitutions(): Promise<Institution[]> {
  const rows = await getRows(SHEET_TABS.institutions);
  const pendingRows = rows.filter((row) => !fromSheetBool(row.Verified ?? ''));
  return Promise.all(pendingRows.map(rowToInstitution));
}

/**
 * Admin Web App foundation — the first Admin action moved off AppSheet. Sets
 * Verified=TRUE (fields lock automatically from that point per rowToInstitution's
 * ALL_PROFILE_FIELDS fallback) and notifies the owning user — this is exactly
 * the "institution_approved" event Module 2 designed but left unwired pending
 * an Admin bridge (Phase 3's BL-1). This function *is* that bridge.
 */
export async function verifyInstitution(institutionId: string): Promise<Institution> {
  const row = await findRow(SHEET_TABS.institutions, (r) => r.Institution_ID === institutionId);
  if (!row) throw new ValidationError('Institution not found');

  await updateRow(SHEET_TABS.institutions, 'Institution_ID', institutionId, {
    Verified: toSheetBool(true),
    Rejection_Reason: '',
  });

  await createNotification({
    recipientUserId: row.User_ID,
    notificationType: 'institution_approved',
    entityType: 'Institution',
    entityId: institutionId,
    message: 'A sua instituição foi verificada! Já pode reclamar doações.',
  });

  const institution = await getInstitutionById(institutionId);
  if (!institution) throw new Error('Institution vanished after verification');
  return institution;
}

/** Admin Web App foundation — rejects with a reason; institution stays unverified and can be re-reviewed. */
export async function rejectInstitution(institutionId: string, reason: string): Promise<Institution> {
  if (!reason || !reason.trim()) throw new ValidationError('A rejection reason is required');

  const row = await findRow(SHEET_TABS.institutions, (r) => r.Institution_ID === institutionId);
  if (!row) throw new ValidationError('Institution not found');

  await updateRow(SHEET_TABS.institutions, 'Institution_ID', institutionId, {
    Verified: toSheetBool(false),
    Rejection_Reason: reason.trim(),
  });

  await createNotification({
    recipientUserId: row.User_ID,
    notificationType: 'institution_rejected',
    entityType: 'Institution',
    entityId: institutionId,
    message: `O seu registo não foi aprovado: ${reason.trim()}`,
  });

  const institution = await getInstitutionById(institutionId);
  if (!institution) throw new Error('Institution vanished after rejection');
  return institution;
}
