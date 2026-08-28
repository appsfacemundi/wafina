import { randomUUID } from 'node:crypto';
import type { AdminSuccessStoryView, SuccessStory, SuccessStoryStatus } from '@wafina/shared';
import { toProxiedUrl } from '../config/photo-storage';
import { SHEET_TABS } from '../config/sheet-tabs';
import { nowIso, parseSheetDate } from '../config/sheet-values';
import { appendRow, findRow, getRows, updateRow } from '../config/sheets';
import { getDonation } from './donations';
import { EMAIL_BRAND_COLOR, EMAIL_LOGO_HTML, escapeHtml, sendEmail } from './email';
import { getInstitutionById } from './institutions';
import { createNotification } from './notifications';
import { findUserById } from './users';
import { ValidationError } from './validation-error';

const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 600;

/**
 * One-click "Enviar para a Feed" quotes, 2026-08-08 (stakeholder decision:
 * a curated random pool instead of a live AI call — same donor-facing
 * result, no external API key/cost/latency/failure-point on a one-click
 * action). Each ends with a `{cidade}` token that resolveAutoStoryContent
 * replaces with " em {City}" when the donation has one, or removes entirely
 * when it doesn't — every template must work grammatically either way.
 */
const AUTO_STORY_QUOTES = [
  'Cada gesto de generosidade transforma vidas — obrigado a quem tornou esta doação possível através da {instituicao}{cidade}.',
  'Ajudar o próximo é parte do que nos torna humanos. Esta doação chegou a quem precisa graças à {instituicao}{cidade}.',
  'Um pequeno gesto, um grande impacto. A {instituicao} tornou esta doação realidade{cidade}.',
  'A generosidade não tem tamanho — apenas coração. Obrigado à {instituicao} por entregar esta doação{cidade}.',
  'Doar é semear esperança. Esta doação foi entregue com o apoio da {instituicao}{cidade}.',
  'Quando ajudamos alguém, ajudamos toda a comunidade. Esta doação passou pelas mãos dedicadas da {instituicao}{cidade}.',
  'A bondade multiplica-se. Graças à {instituicao}, esta doação chegou a quem mais precisava{cidade}.',
  'Fazer o bem é simples: basta começar. A {instituicao} tornou isso possível{cidade}.',
];

function resolveAutoStoryContent(itemType: string, institutionName: string, city: string | null) {
  const quote = AUTO_STORY_QUOTES[Math.floor(Math.random() * AUTO_STORY_QUOTES.length)];
  const description = quote
    .replace('{instituicao}', institutionName)
    .replace('{cidade}', city ? ` em ${city}` : '');
  return { title: `Oferta de ${itemType}`, description };
}

/**
 * Notification preferences module, 2026-08-08 — the personalized email
 * counterpart to the in-app "success_story_published" notification. In-app
 * stays unconditional (per spec); this is the one channel gated by the
 * donor's own Email_Notifications_Enabled setting. Swallows its own
 * failures (via sendEmail) so a missing/misconfigured provider, or a donor
 * with no email on file, never breaks the story-publish action itself.
 */
async function sendImpactStoryEmail(donorId: string, story: { Title: string; Description: string; Image: string }) {
  try {
    const donor = await findUserById(donorId);
    if (!donor?.Email || donor.Email_Notifications_Enabled === 'FALSE') return;
    // Security fix, 2026-08-28 — Title/Description are institution-authored
    // free text (via POST /success-stories, only length-validated), unlike
    // Image (a proxied Drive URL this server itself constructs). Same escaping
    // donations.ts already applies to its own free-text email content.
    const title = escapeHtml(story.Title);
    const description = escapeHtml(story.Description);
    await sendEmail({
      to: donor.Email,
      subject: `Wafina — ${story.Title}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          ${EMAIL_LOGO_HTML}
          <h2 style="color: ${EMAIL_BRAND_COLOR};">A sua doação chegou a quem precisava! ❤️</h2>
          <img src="${story.Image}" alt="" style="width: 100%; border-radius: 8px; margin: 16px 0;" />
          <h3>${title}</h3>
          <p style="color: #475569; line-height: 1.5;">${description}</p>
          <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
            Recebeu este email porque tem as notificações por email ativadas nas definições da sua conta Wafina.
          </p>
        </div>
      `,
    });
  } catch (err) {
    // Same philosophy as createNotification: the story is already published and
    // the in-app notification already sent — a missing email must never turn
    // that into a failed publish action.
    console.error('sendImpactStoryEmail failed (swallowed, does not fail the caller\'s action):', err);
  }
}

function rowToSuccessStory(row: Record<string, string>): SuccessStory {
  return {
    Success_Story_ID: row.Success_Story_ID,
    Institution_ID: row.Institution_ID,
    Donation_ID: row.Donation_ID,
    Donor_ID: row.Donor_ID,
    Title: row.Title,
    Description: row.Description,
    Image: toProxiedUrl(row.Image) ?? '',
    Status: row.Status as SuccessStoryStatus,
    Rejection_Reason: row.Rejection_Reason || null,
    Author_User_ID: row.Author_User_ID,
    Date_Published: row.Date_Published,
    // Existing rows predate this column — an empty cell must mean "on" (the default), not "off".
    Show_Donation_Details: row.Show_Donation_Details !== 'FALSE',
    // Populated by joinInstitutionsAndDonations below, never derived here — rowToSuccessStory has no async lookups.
    Institution_Name: null,
    Item_Type: null,
  };
}

/**
 * Attribution module, 2026-08-08 — batched institution/donation lookups
 * shared by every list function below. getInstitutionById/getDonation both
 * read through sheets.ts's per-tab cache, so this is N in-memory finds
 * against an already-fetched array, not N live Sheets API calls.
 */
async function joinInstitutionsAndDonations(stories: SuccessStory[]) {
  const institutionIds = new Set(stories.map((s) => s.Institution_ID));
  const institutionById = new Map(
    await Promise.all(Array.from(institutionIds).map(async (id) => [id, await getInstitutionById(id)] as const)),
  );
  const donationIds = new Set(stories.map((s) => s.Donation_ID));
  const donationById = new Map(
    await Promise.all(Array.from(donationIds).map(async (id) => [id, await getDonation(id)] as const)),
  );
  return { institutionById, donationById };
}

/** Donor-facing/public views — respects Show_Donation_Details; withheld stories stay null. */
async function enrichRespectingVisibility(stories: SuccessStory[]): Promise<SuccessStory[]> {
  const { institutionById, donationById } = await joinInstitutionsAndDonations(stories);
  return stories.map((story) =>
    story.Show_Donation_Details
      ? {
          ...story,
          Institution_Name: institutionById.get(story.Institution_ID)?.Name ?? null,
          Item_Type: donationById.get(story.Donation_ID)?.Item_Type ?? null,
        }
      : story,
  );
}

/** Institution/Admin views — the institution always sees its own attribution; Admin always moderates with full context. */
async function enrichAlways(stories: SuccessStory[]): Promise<SuccessStory[]> {
  const { institutionById, donationById } = await joinInstitutionsAndDonations(stories);
  return stories.map((story) => ({
    ...story,
    Institution_Name: institutionById.get(story.Institution_ID)?.Name ?? null,
    Item_Type: donationById.get(story.Donation_ID)?.Item_Type ?? null,
  }));
}

export interface CreateSuccessStoryInput {
  Donation_ID: string;
  Title: string;
  Description: string;
  Image: string;
  /** Whether the institution name and donated item type become visible on the published story. Defaults true. */
  Show_Donation_Details?: boolean;
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
    Show_Donation_Details: input.Show_Donation_Details === false ? 'FALSE' : 'TRUE',
  };

  await appendRow(SHEET_TABS.successStories, row);
  return rowToSuccessStory(row);
}

/**
 * Admin Web App Parity gap, 2026-08-08 — Institution had a publish path
 * (createSuccessStory above) but Admin, who already moderates every other
 * piece of donation content (photos, disputes, change requests), had no way
 * to put a story in the donor's Impact Feed directly. Deliberately skips the
 * institution-ownership check createSuccessStory enforces (Admin isn't
 * publishing on an institution's behalf, and any Delivered donation
 * qualifies) and publishes straight to Approved — Admin is the same
 * authority that approveSuccessStory already trusts to publish institution
 * submissions, so there's no one left to gate this behind.
 */
export async function adminCreateSuccessStory(
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
  if (!donation.Claimed_By_Institution_ID) {
    throw new ValidationError('Esta doação não está associada a nenhuma instituição');
  }

  const existing = await getRows(SHEET_TABS.successStories);
  if (existing.some((row) => row.Donation_ID === input.Donation_ID)) {
    throw new ValidationError('Já existe uma História de Sucesso para esta doação');
  }

  const row = {
    Success_Story_ID: randomUUID(),
    Institution_ID: donation.Claimed_By_Institution_ID,
    Donation_ID: input.Donation_ID,
    Donor_ID: donation.Donor_ID,
    Title: input.Title.trim(),
    Description: input.Description.trim(),
    Image: input.Image,
    Status: 'Approved' satisfies SuccessStoryStatus,
    Rejection_Reason: '',
    Author_User_ID: authorUserId,
    Date_Published: nowIso(),
    Show_Donation_Details: input.Show_Donation_Details === false ? 'FALSE' : 'TRUE',
  };

  await appendRow(SHEET_TABS.successStories, row);

  await createNotification({
    recipientUserId: donation.Donor_ID,
    notificationType: 'success_story_published',
    entityType: 'Success_Story',
    entityId: row.Success_Story_ID,
    message: 'A Wafina partilhou uma história de impacto sobre a sua doação!',
  });
  await sendImpactStoryEmail(donation.Donor_ID, row);

  return rowToSuccessStory(row);
}

/**
 * One-click Feed publish, 2026-08-08 (stakeholder simplification of
 * adminCreateSuccessStory above) — for the common case, Admin shouldn't have
 * to upload a new photo or write a title/description just to put an
 * already-delivered donation's own photo on the Feed. Reuses the donation's
 * existing Photo as-is and auto-generates title/description (see
 * resolveAutoStoryContent). adminCreateSuccessStory remains the deliberate
 * "upload something different" path when the donation's own photo isn't
 * what should go on the Feed.
 */
export async function adminQuickPublishToFeed(donationId: string, authorUserId: string): Promise<SuccessStory> {
  const donation = await getDonation(donationId);
  if (!donation) throw new ValidationError('Doação não encontrada');
  if (donation.Status !== 'Delivered') {
    throw new ValidationError('Só é possível publicar uma História de Sucesso para uma doação entregue');
  }
  if (!donation.Claimed_By_Institution_ID) {
    throw new ValidationError('Esta doação não está associada a nenhuma instituição');
  }
  if (!donation.Photo) {
    throw new ValidationError('Esta doação não tem fotografia — carregue uma pelo PC.');
  }

  const existing = await getRows(SHEET_TABS.successStories);
  if (existing.some((row) => row.Donation_ID === donationId)) {
    throw new ValidationError('Já existe uma História de Sucesso para esta doação');
  }

  const institution = await getInstitutionById(donation.Claimed_By_Institution_ID);
  const { title, description } = resolveAutoStoryContent(
    donation.Item_Type,
    institution?.Name ?? 'uma instituição parceira',
    donation.City,
  );

  const row = {
    Success_Story_ID: randomUUID(),
    Institution_ID: donation.Claimed_By_Institution_ID,
    Donation_ID: donationId,
    Donor_ID: donation.Donor_ID,
    Title: title,
    Description: description,
    Image: donation.Photo,
    Status: 'Approved' satisfies SuccessStoryStatus,
    Rejection_Reason: '',
    Author_User_ID: authorUserId,
    Date_Published: nowIso(),
    // No form on this one-click action to ask, so always visible — matches
    // resolveAutoStoryContent already naming the institution in the quote text.
    Show_Donation_Details: 'TRUE',
  };

  await appendRow(SHEET_TABS.successStories, row);

  await createNotification({
    recipientUserId: donation.Donor_ID,
    notificationType: 'success_story_published',
    entityType: 'Success_Story',
    entityId: row.Success_Story_ID,
    message: 'A Wafina partilhou uma história de impacto sobre a sua doação!',
  });
  await sendImpactStoryEmail(donation.Donor_ID, row);

  return rowToSuccessStory(row);
}

// Pilot feedback, 2026-08-05 — same missing-sort pattern already fixed
// today on listDonationsByDonor, listAvailableDonations, and
// listDonationsClaimedByInstitution, but never caught on any of the
// Success_Stories list functions. All four sorted here, not just the one
// reported, since every prior round of this fix turned out to have a
// sibling function that got missed.
function byPublishedDesc(a: SuccessStory, b: SuccessStory): number {
  return parseSheetDate(b.Date_Published) - parseSheetDate(a.Date_Published);
}

/** Institution's own stories, any status — the "Histórias de Impacto" list with status filter tabs. Always full context, own submissions. */
export async function listSuccessStoriesByInstitution(institutionId: string): Promise<SuccessStory[]> {
  const rows = await getRows(SHEET_TABS.successStories);
  const stories = rows
    .filter((row) => row.Institution_ID === institutionId)
    .map(rowToSuccessStory)
    .sort(byPublishedDesc);
  return enrichAlways(stories);
}

/** Donor-facing — Approved stories about their own donations only (not a public feed). */
export async function listSuccessStoriesByDonor(donorId: string): Promise<SuccessStory[]> {
  const rows = await getRows(SHEET_TABS.successStories);
  const stories = rows
    .filter((row) => row.Donor_ID === donorId && row.Status === 'Approved')
    .map(rowToSuccessStory)
    .sort(byPublishedDesc);
  return enrichRespectingVisibility(stories);
}

/**
 * Launch-readiness module, 2026-08-08 — backs a donor's "Public" Impact feed
 * setting (Users.Impact_Feed_Visibility). Every Approved story platform-wide,
 * not scoped to one donor — the approval gate itself (Status === 'Approved')
 * is what makes this safe to show broadly, same gate listSuccessStoriesByDonor
 * already relies on above.
 */
export async function listPublicSuccessStories(): Promise<SuccessStory[]> {
  const rows = await getRows(SHEET_TABS.successStories);
  const stories = rows
    .filter((row) => row.Status === 'Approved')
    .map(rowToSuccessStory)
    .sort(byPublishedDesc);
  return enrichRespectingVisibility(stories);
}

/** Admin Web App Parity Phase C — Reports, every story regardless of status. Always full context. */
export async function listAllSuccessStories(): Promise<SuccessStory[]> {
  const rows = await getRows(SHEET_TABS.successStories);
  return enrichAlways(rows.map(rowToSuccessStory).sort(byPublishedDesc));
}

/** Admin moderation queue. Always full context regardless of Show_Donation_Details — Admin is moderating, not viewing the public-facing result. */
export async function listPendingSuccessStories(): Promise<AdminSuccessStoryView[]> {
  const rows = await getRows(SHEET_TABS.successStories);
  const pending = await enrichAlways(
    rows.filter((row) => row.Status === 'Pending').map(rowToSuccessStory).sort(byPublishedDesc),
  );

  const institutionIds = new Set(pending.map((s) => s.Institution_ID));
  const institutionById = new Map(
    await Promise.all(
      Array.from(institutionIds).map(async (id) => [id, await getInstitutionById(id)] as const),
    ),
  );

  return pending.map((story) => ({
    ...story,
    Institution_Logo: institutionById.get(story.Institution_ID)?.Logo ?? null,
  }));
}

/**
 * Admin management view, launch-critical 2026-08-08 — every currently-live
 * (Approved) story, whether it was published by an institution or directly
 * by Admin, so Admin has one place to replace a photo or take a story down.
 * Always full context regardless of Show_Donation_Details, same reasoning as
 * listPendingSuccessStories above.
 */
export async function listPublishedSuccessStories(): Promise<AdminSuccessStoryView[]> {
  const rows = await getRows(SHEET_TABS.successStories);
  const published = await enrichAlways(
    rows.filter((row) => row.Status === 'Approved').map(rowToSuccessStory).sort(byPublishedDesc),
  );

  const institutionIds = new Set(published.map((s) => s.Institution_ID));
  const institutionById = new Map(
    await Promise.all(Array.from(institutionIds).map(async (id) => [id, await getInstitutionById(id)] as const)),
  );

  return published.map((story) => ({
    ...story,
    Institution_Logo: institutionById.get(story.Institution_ID)?.Logo ?? null,
  }));
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
  await sendImpactStoryEmail(story.Donor_ID, story);

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

/**
 * Admin management, launch-critical 2026-08-08 — swaps the photo on an
 * already-live story without touching its title/description/status. No
 * notification: the photo is a presentation detail, not a moderation
 * decision either side needs to be told about (unlike approve/reject/remove).
 */
export async function adminReplaceSuccessStoryPhoto(storyId: string, imageUrl: string): Promise<SuccessStory> {
  await getSuccessStoryOrThrow(storyId);
  await updateRow(SHEET_TABS.successStories, 'Success_Story_ID', storyId, { Image: imageUrl });
  return getSuccessStoryOrThrow(storyId);
}

/**
 * Admin management, launch-critical 2026-08-08 — takes a currently-live story
 * out of every feed (listPublicSuccessStories/listSuccessStoriesByDonor both
 * gate on Status === 'Approved') without deleting the row, same soft-removal
 * pattern as everything else in this codebase (suspendUser, setCountryActive,
 * setPartnerActive...). Reuses the Rejected status/Rejection_Reason column
 * rather than adding a new status value, but with its own notification type
 * and message — a story that was live and got taken down is a different
 * event for the institution than one that never made it out of moderation.
 */
export async function removeSuccessStoryFromFeed(storyId: string, reason: string): Promise<SuccessStory> {
  if (!reason || !reason.trim()) throw new ValidationError('O motivo da remoção é obrigatório');

  const existing = await getSuccessStoryOrThrow(storyId);
  if (existing.Status !== 'Approved') throw new ValidationError('Só é possível remover uma história publicada');

  await updateRow(SHEET_TABS.successStories, 'Success_Story_ID', storyId, {
    Status: 'Rejected',
    Rejection_Reason: reason.trim(),
  });
  const story = await getSuccessStoryOrThrow(storyId);

  const institution = await getInstitutionById(story.Institution_ID);
  if (institution?.User_ID) {
    await createNotification({
      recipientUserId: institution.User_ID,
      notificationType: 'success_story_removed',
      entityType: 'Success_Story',
      entityId: story.Success_Story_ID,
      message: `A sua história "${story.Title}" foi removida da Feed de Impacto. Motivo: ${reason.trim()}`,
    });
  }

  return story;
}
