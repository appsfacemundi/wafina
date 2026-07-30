import { randomUUID } from 'node:crypto';
import type { SuccessStory, SuccessStoryStatus } from '@wafina/shared';
import { SHEET_TABS } from '../config/sheet-tabs';
import { nowIso } from '../config/sheet-values';
import { appendRow, getRows } from '../config/sheets';
import { getDonation } from './donations';
import { createNotification } from './notifications';
import { ValidationError } from './validation-error';

const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 600;

function rowToSuccessStory(row: Record<string, string>): SuccessStory {
  return {
    Success_Story_ID: row.Success_Story_ID,
    Institution_ID: row.Institution_ID,
    Donation_ID: row.Donation_ID,
    Donor_ID: row.Donor_ID,
    Title: row.Title,
    Description: row.Description,
    Image: row.Image,
    Status: row.Status as SuccessStoryStatus,
    Author_User_ID: row.Author_User_ID,
    Date_Published: row.Date_Published,
  };
}

export interface CreateSuccessStoryInput {
  Donation_ID: string;
  Title: string;
  Description: string;
  Image: string;
}

/**
 * Phase 3A Module 2 — MVP. Only a verified institution (enforced by the
 * requireVerified route middleware, same as disputes/change-requests) can
 * publish, and only about a donation it actually delivered. Status defaults
 * to Approved because no Admin Panel exists yet to moderate — the column and
 * values are ready for that (SUCCESS_STORY_STATUSES) so a future moderation
 * workflow only needs to change the default and add an Admin action, not the
 * schema. Notifies the donor on publish (spec requirement).
 */
export async function createSuccessStory(
  institutionId: string,
  authorUserId: string,
  input: CreateSuccessStoryInput,
): Promise<SuccessStory> {
  if (!input.Title || !input.Title.trim()) throw new ValidationError('Title is required');
  if (input.Title.length > MAX_TITLE_LENGTH) {
    throw new ValidationError(`Title may not exceed ${MAX_TITLE_LENGTH} characters`);
  }
  if (!input.Description || !input.Description.trim()) {
    throw new ValidationError('Description is required');
  }
  if (input.Description.length > MAX_DESCRIPTION_LENGTH) {
    throw new ValidationError(`Description may not exceed ${MAX_DESCRIPTION_LENGTH} characters`);
  }
  if (!input.Image) throw new ValidationError('Image is required');

  const donation = await getDonation(input.Donation_ID);
  if (!donation) throw new ValidationError('Donation not found');
  if (donation.Status !== 'Delivered') {
    throw new ValidationError('A Success Story can only be published for a Delivered donation');
  }
  if (donation.Claimed_By_Institution_ID !== institutionId) {
    throw new ValidationError('This donation was not delivered by your institution');
  }

  const existing = await getRows(SHEET_TABS.successStories);
  if (existing.some((row) => row.Donation_ID === input.Donation_ID)) {
    throw new ValidationError('A Success Story already exists for this donation');
  }

  const row = {
    Success_Story_ID: randomUUID(),
    Institution_ID: institutionId,
    Donation_ID: input.Donation_ID,
    Donor_ID: donation.Donor_ID,
    Title: input.Title.trim(),
    Description: input.Description.trim(),
    Image: input.Image,
    Status: 'Approved' satisfies SuccessStoryStatus,
    Author_User_ID: authorUserId,
    Date_Published: nowIso(),
  };

  await appendRow(SHEET_TABS.successStories, row);
  const story = rowToSuccessStory(row);

  await createNotification({
    recipientUserId: story.Donor_ID,
    notificationType: 'success_story_published',
    entityType: 'Success_Story',
    entityId: story.Success_Story_ID,
    message: 'A instituição partilhou uma história de impacto sobre a sua doação!',
  });

  return story;
}

/** Institution's own published stories. */
export async function listSuccessStoriesByInstitution(institutionId: string): Promise<SuccessStory[]> {
  const rows = await getRows(SHEET_TABS.successStories);
  return rows.filter((row) => row.Institution_ID === institutionId).map(rowToSuccessStory);
}

/** Donor-facing — stories published about their own donations only (not a public feed). */
export async function listSuccessStoriesByDonor(donorId: string): Promise<SuccessStory[]> {
  const rows = await getRows(SHEET_TABS.successStories);
  return rows
    .filter((row) => row.Donor_ID === donorId && row.Status === 'Approved')
    .map(rowToSuccessStory);
}
