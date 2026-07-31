import { randomUUID } from 'node:crypto';
import type { AdminDisputeView, Dispute, DisputeStatus } from '@wafina/shared';
import { SHEET_TABS } from '../config/sheet-tabs';
import { nowIso } from '../config/sheet-values';
import { appendRow, findRow, getRows, updateRow } from '../config/sheets';
import { getDonation } from './donations';
import { getInstitutionById } from './institutions';
import { createNotification } from './notifications';
import { ValidationError } from './validation-error';

const MIN_DESCRIPTION_LENGTH = 10;

function rowToDispute(row: Record<string, string>): Dispute {
  return {
    Dispute_ID: row.Dispute_ID,
    Donation_ID: row.Donation_ID,
    Raised_By: row.Raised_By,
    Issue_Description: row.Issue_Description,
    Status: row.Status as DisputeStatus,
    Resolution_Notes: row.Resolution_Notes || null,
    Date_Raised: row.Date_Raised,
    Date_Resolved: row.Date_Resolved || null,
  };
}

/**
 * Spec 11.3: only for Claimed/Delivered donations, only by the institution
 * that claimed them. Admin resolves via resolveDispute() below (previously
 * "exclusively in AppSheet" — stale now that AppSheet is retired from the
 * architecture, 2026-07-30).
 */
export async function createDispute(
  institutionId: string,
  userId: string,
  donationId: string,
  issueDescription: string,
): Promise<Dispute> {
  if (!issueDescription || issueDescription.trim().length < MIN_DESCRIPTION_LENGTH) {
    throw new ValidationError(
      `A descrição do problema deve ter pelo menos ${MIN_DESCRIPTION_LENGTH} caracteres`,
    );
  }

  const donation = await getDonation(donationId);
  if (!donation) throw new ValidationError('Doação não encontrada');
  if (donation.Status !== 'Claimed' && donation.Status !== 'Delivered') {
    throw new ValidationError('Só é possível abrir uma ocorrência para doações aceites ou entregues');
  }
  if (donation.Claimed_By_Institution_ID !== institutionId) {
    throw new ValidationError('Esta doação não foi aceite pela sua instituição');
  }

  const row = {
    Dispute_ID: randomUUID(),
    Donation_ID: donationId,
    Raised_By: userId,
    Issue_Description: issueDescription,
    Status: 'Open',
    Resolution_Notes: '',
    Date_Raised: nowIso(),
    Date_Resolved: '',
  };

  await appendRow(SHEET_TABS.disputes, row);
  const dispute = rowToDispute(row);

  // Phase 3A Module 2 — self-confirmation; previously the raiser got no
  // acknowledgement at all that their dispute was actually recorded.
  await createNotification({
    recipientUserId: userId,
    notificationType: 'dispute_created',
    entityType: 'Dispute',
    entityId: dispute.Dispute_ID,
    message: 'A sua ocorrência foi registada e será analisada pelo Admin.',
  });

  return dispute;
}

/** "My Disputes" (spec 9.2) — Disputes are keyed by Donation_ID, so join through Donations. */
export async function listDisputesByInstitution(institutionId: string): Promise<Dispute[]> {
  const [disputeRows, donationRows] = await Promise.all([
    getRows(SHEET_TABS.disputes),
    getRows(SHEET_TABS.donations),
  ]);

  const ownDonationIds = new Set(
    donationRows
      .filter((row) => row.Claimed_By_Institution_ID === institutionId)
      .map((row) => row.Donation_ID),
  );

  return disputeRows.filter((row) => ownDonationIds.has(row.Donation_ID)).map(rowToDispute);
}

/**
 * Admin moderation queue (Admin Web App Parity module, 2026-07-31) — this
 * used to happen "exclusively in AppSheet"; stale now that AppSheet is
 * retired from the architecture. Joins through Donations/Institutions purely
 * for display context (which institution/item this dispute is about).
 */
export async function listAllOpenDisputes(): Promise<AdminDisputeView[]> {
  const [disputeRows, donationRows] = await Promise.all([
    getRows(SHEET_TABS.disputes),
    getRows(SHEET_TABS.donations),
  ]);

  const open = disputeRows.filter((row) => row.Status === 'Open').map(rowToDispute);
  const donationById = new Map(donationRows.map((row) => [row.Donation_ID, row]));
  const institutionIds = new Set(
    open
      .map((d) => donationById.get(d.Donation_ID)?.Claimed_By_Institution_ID)
      .filter((id): id is string => Boolean(id)),
  );
  const institutionById = new Map(
    await Promise.all(Array.from(institutionIds).map(async (id) => [id, await getInstitutionById(id)] as const)),
  );

  return open.map((dispute) => {
    const donation = donationById.get(dispute.Donation_ID);
    const institution = donation?.Claimed_By_Institution_ID
      ? institutionById.get(donation.Claimed_By_Institution_ID)
      : null;
    return {
      ...dispute,
      Institution_Name: institution?.Name ?? null,
      Institution_Logo: institution?.Logo ?? null,
      Donation_Item_Type: donation?.Item_Type ?? null,
      Donation_Public_Code: donation?.Public_Donation_Code ?? null,
    };
  });
}

async function getDisputeOrThrow(disputeId: string): Promise<Dispute> {
  const row = await findRow(SHEET_TABS.disputes, (r) => r.Dispute_ID === disputeId);
  if (!row) throw new ValidationError('Ocorrência não encontrada');
  return rowToDispute(row);
}

/** Admin resolves — notifies the institution user who raised it, with the resolution notes. */
export async function resolveDispute(disputeId: string, resolutionNotes: string): Promise<Dispute> {
  if (!resolutionNotes || !resolutionNotes.trim()) {
    throw new ValidationError('As notas de resolução são obrigatórias');
  }

  const dispute = await getDisputeOrThrow(disputeId);
  if (dispute.Status !== 'Open') throw new ValidationError('Só é possível resolver uma ocorrência em aberto');

  await updateRow(SHEET_TABS.disputes, 'Dispute_ID', disputeId, {
    Status: 'Resolved' satisfies DisputeStatus,
    Resolution_Notes: resolutionNotes.trim(),
    Date_Resolved: nowIso(),
  });

  await createNotification({
    recipientUserId: dispute.Raised_By,
    notificationType: 'dispute_resolved',
    entityType: 'Dispute',
    entityId: disputeId,
    message: `A sua ocorrência foi resolvida pelo Admin: ${resolutionNotes.trim()}`,
  });

  return getDisputeOrThrow(disputeId);
}
