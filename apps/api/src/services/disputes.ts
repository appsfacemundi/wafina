import { randomUUID } from 'node:crypto';
import type { Dispute, DisputeStatus } from '@wafina/shared';
import { SHEET_TABS } from '../config/sheet-tabs';
import { nowIso } from '../config/sheet-values';
import { appendRow, getRows } from '../config/sheets';
import { getDonation } from './donations';
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
 * that claimed them. Admin resolution (Status/Resolution_Notes/Date_Resolved)
 * happens exclusively in AppSheet — there is no resolve function here.
 */
export async function createDispute(
  institutionId: string,
  userId: string,
  donationId: string,
  issueDescription: string,
): Promise<Dispute> {
  if (!issueDescription || issueDescription.trim().length < MIN_DESCRIPTION_LENGTH) {
    throw new ValidationError(
      `Issue_Description must be at least ${MIN_DESCRIPTION_LENGTH} characters`,
    );
  }

  const donation = await getDonation(donationId);
  if (!donation) throw new ValidationError('Donation not found');
  if (donation.Status !== 'Claimed' && donation.Status !== 'Delivered') {
    throw new ValidationError('Disputes can only be raised for Claimed or Delivered donations');
  }
  if (donation.Claimed_By_Institution_ID !== institutionId) {
    throw new ValidationError('This donation was not claimed by your institution');
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
    message: 'A sua disputa foi registada e será analisada pelo Admin.',
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
