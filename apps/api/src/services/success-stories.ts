import { randomUUID } from 'node:crypto';
import type { AdminSuccessStoryView, SuccessStory, SuccessStoryStatus } from '@wafina/shared';
import { SHEET_TABS } from '../config/sheet-tabs';
import { nowIso } from '../config/sheet-values';
import { appendRow, findRow, getRows, updateRow } from '../config/sheets';
import { getDonation } from './donations';
import { getInstitutionById } from './institutions';
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
    Rejection_Reason: row.Rejection_Reason || null,
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
 * Admin moderation module (2026-07-31) — only a verified institution
 * (enforced by the requireVerified route middleware, same as
 * disputes/change-requests) can submit, and only about a donation it
 * actually delivered. Status defaults to Pending: nothing publishes
 * automatically. The donor is deliberately NOT notified here — they only
 * find out once Admin approves (see approveSuccessStory), so a donor is
 * never shown a "shared a story" notification for something they can't
 * actually see yet.
 */
export async function createSuccessStory(
  institutionId: string,
  authorUserId: string,
  input: CreateSuccessStoryInput,
): Promise<SuccessStory> {
  if (!input.Title || !input.Title.trim()) throw new ValidationError('O título é obrigatório');
  if (input.Title.length > MAX_TITLE_LENGTH) {
    throw new ValidationError(`O título não pode exceder ${MAX_TITLE_LENGTH} caracteres`);
  }
  if (!input.Description || !input.Description.trim()) {
    throw new ValidationError('A descrição é obrigatória');
  }
  if (input.Description.length > MAX_DESCRIPTION_LENGTH) {
    throw new ValidationError(`A descrição não pode exceder ${MAX_DESCRIPTION_LENGTH} caracteres`);
  }
  if (!input.Image) throw new ValidationError('A imagem é obrigatória');

  const donation = await getDonation(input.Donation_ID);
  if (!donation) throw new ValidationError('Doação não encontrada');
  if (donation.Status !== 'Delivered') {
    throw new ValidationError('Só é possível publicar uma História de Sucesso para uma doação entregue');
  }
  if (donation.Claimed_By_Institution_ID !== institutionId) {
    throw new ValidationError('Esta doação não foi entregue pela sua instituição');
  }

  const existing = await getRows(SHEET_TABS.successStories);
  if (existing.some((row) => row.Donation_ID === input.Donation_ID)) {
    throw new ValidationError('Já existe uma História de Sucesso para esta doação');
  }

  const row = {
    Success_Story_ID: randomUUID(),
    Institution_ID: institutionId,
    Donation_ID: input.Donation_ID,
    Donor_ID: donation.Donor_ID,
    Title: input.Title.trim(),
    Description: input.Description.trim(),
    Image: input.Image,
    Status: 'Pending' satisfies SuccessStoryStatus,
    Rejection_Reason: '',
    Author_User_ID: authorUserId,
    Date_Published: nowIso(),
  };

  await appendRow(SHEET_TABS.successStories, row);
  return rowToSuccessStory(row);
}

// Pilot feedback, 2026-08-05 — same missing-sort pattern already fixed
// today on listDonationsByDonor, listAvailableDonations, and
// listDonationsClaimedByInstitution, but never caught on any of the
// Success_Stories list functions. All four sorted here, not just the one
// reported, since every prior round of this fix turned out to have a
// sibling function that got missed.
function byPublishedDesc(a: SuccessStory, b: SuccessStory): number {
  return (b.Date_Published || '').localeCompare(a.Date_Published || '');
}

/** Institution's own stories, any status — the "Histórias de Impacto" list with status filter tabs. */
export async function listSuccessStoriesByInstitution(institutionId: string): Promise<SuccessStory[]> {
  const rows = await getRows(SHEET_TABS.successStories);
  return rows
    .filter((row) => row.Institution_ID === institutionId)
    .map(rowToSuccessStory)
    .sort(byPublishedDesc);
}

/** Donor-facing — Approved stories about their own donations only (not a public feed). */
export async function listSuccessStoriesByDonor(donorId: string): Promise<SuccessStory[]> {
  const rows = await getRows(SHEET_TABS.successStories);
  return rows
    .filter((row) => row.Donor_ID === donorId && row.Status === 'Approved')
    .map(rowToSuccessStory)
    .sort(byPublishedDesc);
}

/** Admin Web App Parity Phase C — Reports, every story regardless of status. */
export async function listAllSuccessStories(): Promise<SuccessStory[]> {
  const rows = await getRows(SHEET_TABS.successStories);
  return rows.map(rowToSuccessStory).sort(byPublishedDesc);
}

/** Admin moderation queue. */
export async function listPendingSuccessStories(): Promise<AdminSuccessStoryView[]> {
  const rows = await getRows(SHEET_TABS.successStories);
  const pending = rows.filter((row) => row.Status === 'Pending').map(rowToSuccessStory).sort(byPublishedDesc);

  const institutionIds = new Set(pending.map((s) => s.Institution_ID));
  const institutionById = new Map(
    await Promise.all(
      Array.from(institutionIds).map(async (id) => [id, await getInstitutionById(id)] as const),
    ),
  );

  return pending.map((story) => {
    const institution = institutionById.get(story.Institution_ID);
    return {
      ...story,
      Institution_Name: institution?.Name ?? null,
      Institution_Logo: institution?.Logo ?? null,
    };
  });
}

async function getSuccessStoryOrThrow(storyId: string): Promise<SuccessStory> {
  const row = await findRow(SHEET_TABS.successStories, (r) => r.Success_Story_ID === storyId);
  if (!row) throw new ValidationError('História de Sucesso não encontrada');
  return rowToSuccessStory(row);
}

/**
 * Admin approves — this is the moment the story actually becomes visible to
 * the donor (listSuccessStoriesByDonor) and any future public gallery. Only
 * now does the donor get notified; the institution is notified too, so both
 * sides always know the current status.
 */
export async function approveSuccessStory(storyId: string): Promise<SuccessStory> {
  const existing = await getSuccessStoryOrThrow(storyId);
  if (existing.Status !== 'Pending') throw new ValidationError('Só é possível aprovar uma história pendente');

  await updateRow(SHEET_TABS.successStories, 'Success_Story_ID', storyId, {
    Status: 'Approved',
    Rejection_Reason: '',
  });
  const story = await getSuccessStoryOrThrow(storyId);

  await createNotification({
    recipientUserId: story.Donor_ID,
    notificationType: 'success_story_published',
    entityType: 'Success_Story',
    entityId: story.Success_Story_ID,
    message: 'A instituição partilhou uma história de impacto sobre a sua doação!',
  });

  const institution = await getInstitutionById(story.Institution_ID);
  if (institution?.User_ID) {
    await createNotification({
      recipientUserId: institution.User_ID,
      notificationType: 'success_story_approved',
      entityType: 'Success_Story',
      entityId: story.Success_Story_ID,
      message: `A sua história "${story.Title}" foi aprovada e já está visível ao doador.`,
    });
  }

  return story;
}

/** Admin rejects — institution is notified with the reason; the donor never saw it, so isn't notified. */
export async function rejectSuccessStory(storyId: string, reason: string): Promise<SuccessStory> {
  if (!reason || !reason.trim()) throw new ValidationError('O motivo de rejeição é obrigatório');

  const existing = await getSuccessStoryOrThrow(storyId);
  if (existing.Status !== 'Pending') throw new ValidationError('Só é possível rejeitar uma história pendente');

  await updateRow(SHEET_TABS.successStories, 'Success_Story_ID', storyId, {
    Status: 'Rejected',
    Rejection_Reason: reason.trim(),
  });
  const story = await getSuccessStoryOrThrow(storyId);

  const institution = await getInstitutionById(story.Institution_ID);
  if (institution?.User_ID) {
    await createNotification({
      recipientUserId: institution.User_ID,
      notificationType: 'success_story_rejected',
      entityType: 'Success_Story',
      entityId: story.Success_Story_ID,
      message: `A sua história "${story.Title}" foi rejeitada. Motivo: ${reason.trim()}`,
    });
  }

  return story;
}
