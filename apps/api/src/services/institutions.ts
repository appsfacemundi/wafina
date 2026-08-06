import { randomUUID } from 'node:crypto';
import type { Institution } from '@wafina/shared';
import { toProxiedUrl } from '../config/photo-storage';
import { SHEET_TABS } from '../config/sheet-tabs';
import { fromSheetBool, fromSheetLatLong, nowIso, toSheetBool, toSheetLatLong } from '../config/sheet-values';
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
    Logo: toProxiedUrl(row.Logo),
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
    Address: row.Address || null,
    Created_At: row.Created_At || null,
  };
}

export interface CreateInstitutionInput {
  Name: string;
  Type: string;
  Location: { lat: number; lng: number };
  /** RC1 design decision, 2026-08-06: logo is part of registration, required — not a post-hoc Settings upload. */
  Logo: string;
  Needs_List?: string;
  /** Phase 3A Module 1 — the institution's actual operating country, required. */
  Country_ID: string;
  /** Province/Municipality/District, optional until that depth of data exists. */
  Region_ID?: string;
  Service_Radius_Km?: number;
  Coverage_Area?: string;
  /** The typed address that was geocoded into Location, when GPS wasn't available. */
  Address?: string;
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
    throw new ValidationError(`O nome deve ter pelo menos ${MIN_NAME_LENGTH} caracteres`);
  }
  if (!input.Type) throw new ValidationError('O tipo é obrigatório');
  if (!input.Logo) throw new ValidationError('O logótipo da instituição é obrigatório');
  if (
    !Number.isFinite(input.Location?.lat) ||
    !Number.isFinite(input.Location?.lng) ||
    (input.Location.lat === 0 && input.Location.lng === 0)
  ) {
    throw new ValidationError('A localização deve ser um par de coordenadas válido e diferente de zero');
  }
  if (!input.Country_ID || !(await isActiveCountry(input.Country_ID))) {
    throw new ValidationError('É necessário indicar um país válido e atualmente suportado');
  }
  if (
    input.Service_Radius_Km !== undefined &&
    (!Number.isFinite(input.Service_Radius_Km) || input.Service_Radius_Km <= 0)
  ) {
    throw new ValidationError('O raio de serviço deve ser um número positivo');
  }

  const existing = await findRow(SHEET_TABS.institutions, (r) => r.User_ID === userId);
  // RC1 design decision, 2026-08-06: rejection must allow correcting and
  // resubmitting (the reject flow's whole point) — found live during Epic 0
  // verification that this unconditionally blocked ANY existing row,
  // permanently locking out a rejected institution with no way back in.
  // A rejected row (not Verified, has a Rejection_Reason) updates in place;
  // a pending-or-verified row still blocks, since neither of those should
  // be re-submitted over.
  const isResubmission =
    existing && !fromSheetBool(existing.Verified ?? '') && Boolean(existing.Rejection_Reason);
  if (existing && !isResubmission) {
    throw new ValidationError('Este utilizador já tem um perfil de Instituição');
  }

  const row = {
    Institution_ID: existing ? existing.Institution_ID : randomUUID(),
    User_ID: userId,
    Name: input.Name,
    Type: input.Type,
    Location: toSheetLatLong(input.Location),
    Verified: toSheetBool(false),
    Needs_List: input.Needs_List ?? '',
    Logo: input.Logo,
    Rejection_Reason: '',
    Country_ID: input.Country_ID,
    Region_ID: input.Region_ID ?? '',
    Service_Radius_Km: input.Service_Radius_Km !== undefined ? String(input.Service_Radius_Km) : '',
    Coverage_Area: input.Coverage_Area ?? '',
    Address: input.Address ?? '',
    // Resubmission counts as newly-registered for queue purposes — it
    // needs fresh Admin attention now, not to stay buried at its original
    // registration time.
    Created_At: nowIso(),
  };

  if (isResubmission) {
    await updateRow(SHEET_TABS.institutions, 'Institution_ID', row.Institution_ID, row);
  } else {
    await appendRow(SHEET_TABS.institutions, row);
  }
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
  // Epic 0.5, 2026-08-06: newest-registered first, now that Created_At exists —
  // same `|| ''` fallback idiom as Donations/SuccessStories, so institutions
  // registered before this field existed sort last rather than erroring.
  const verifiedRows = rows
    .filter((row) => fromSheetBool(row.Verified ?? '') && (!countryId || row.Country_ID === countryId))
    .sort((a, b) => (b.Created_At || '').localeCompare(a.Created_At || ''));
  return Promise.all(verifiedRows.map(rowToInstitution));
}

/** Admin Web App foundation — institutions awaiting verification (spec 11.2). */
export async function listPendingInstitutions(): Promise<Institution[]> {
  const rows = await getRows(SHEET_TABS.institutions);
  const pendingRows = rows
    .filter((row) => !fromSheetBool(row.Verified ?? ''))
    .sort((a, b) => (b.Created_At || '').localeCompare(a.Created_At || ''));
  return Promise.all(pendingRows.map(rowToInstitution));
}

/** Admin Web App Parity Phase C — Reports, unfiltered by verification status. */
export async function listAllInstitutions(): Promise<Institution[]> {
  const rows = await getRows(SHEET_TABS.institutions);
  const sorted = [...rows].sort((a, b) => (b.Created_At || '').localeCompare(a.Created_At || ''));
  return Promise.all(sorted.map(rowToInstitution));
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
  if (!row) throw new ValidationError('Instituição não encontrada');

  await updateRow(SHEET_TABS.institutions, 'Institution_ID', institutionId, {
    Verified: toSheetBool(true),
    Rejection_Reason: '',
  });

  await createNotification({
    recipientUserId: row.User_ID,
    notificationType: 'institution_approved',
    entityType: 'Institution',
    entityId: institutionId,
    message: 'A sua instituição foi verificada! Já pode aceitar doações.',
  });

  const institution = await getInstitutionById(institutionId);
  if (!institution) throw new Error('Institution vanished after verification');
  return institution;
}

/**
 * Institution UX module — logo upload, the piece "Identity Everywhere" needed
 * that never had a write path before (Logo existed in the schema since Module
 * 1's original design, but this service deliberately exposed no update
 * function at all). Respects the same field-lock rule every other profile
 * field already follows: allowed while Logo isn't in Locked_Fields (true
 * before verification, and after an Admin-granted Change Request unlock),
 * blocked once verification has locked it — same rule, just finally usable.
 */
export async function updateInstitutionLogo(institutionId: string, logoUrl: string): Promise<Institution> {
  const institution = await getInstitutionById(institutionId);
  if (!institution) throw new ValidationError('Instituição não encontrada');
  if (institution.Locked_Fields.includes('Logo')) {
    throw new ValidationError('O logótipo está bloqueado — peça uma alteração através de "Pedir Alteração"');
  }

  await updateRow(SHEET_TABS.institutions, 'Institution_ID', institutionId, { Logo: logoUrl });
  const updated = await getInstitutionById(institutionId);
  if (!updated) throw new Error('Institution vanished after logo update');
  return updated;
}

/** Admin Web App foundation — rejects with a reason; institution stays unverified and can be re-reviewed. */
export async function rejectInstitution(institutionId: string, reason: string): Promise<Institution> {
  if (!reason || !reason.trim()) throw new ValidationError('O motivo de rejeição é obrigatório');

  const row = await findRow(SHEET_TABS.institutions, (r) => r.Institution_ID === institutionId);
  if (!row) throw new ValidationError('Instituição não encontrada');

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
