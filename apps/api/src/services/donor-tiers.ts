import { DONOR_TIER_THRESHOLDS, getNewlyCrossedTier, type DonorTier } from '@wafina/shared';
import { SHEET_TABS } from '../config/sheet-tabs';
import { getRows, updateRow } from '../config/sheets';
import { EMAIL_BRAND_COLOR, EMAIL_LOGO_HTML, sendEmail } from './email';
import { findUserById } from './users';

/** Matches donations.ts's own local EmailLocale — no stored per-user language preference exists yet (see that file's comment); every call site here passes the same RC1 default of 'pt'. */
type EmailLocale = 'pt' | 'en';

/** Donor loyalty milestones (2026-08-17) — counts only Delivered donations (both institution-confirmed and RECEBER individual-pickup-confirmed both set Status='Delivered'), never every submission — a milestone should mean the item actually reached someone. */
export async function countDeliveredDonationsForDonor(donorId: string): Promise<number> {
  const rows = await getRows(SHEET_TABS.donations);
  return rows.filter((row) => row.Donor_ID === donorId && row.Status === 'Delivered').length;
}

/**
 * Donor loyalty milestones (2026-08-17) — Email #3 in the donation lifecycle
 * sequence (after #1 "claimed"/"reserved" and #2 "received"). Self-contained
 * try/catch, same philosophy as donations.ts's sendDonationClaimedEmail/
 * sendDonationReceivedEmail: never throws, so a missing/misconfigured email
 * provider can never turn a successful delivery confirmation into a failure.
 * No in-app redemption flow (stakeholder decision) — purely "you earned a
 * gift, contact us to claim it."
 */
async function sendMilestoneEmail(
  donorEmail: string,
  tier: DonorTier,
  deliveredCount: number,
  locale: EmailLocale = 'pt',
): Promise<void> {
  try {
    const copy: Record<EmailLocale, { subject: string; heading: string; body1: string; body2: string; footer: string }> = {
      pt: {
        subject: `Wafina — Parabéns! Atingiu o nível ${tier} 🏅`,
        heading: `Parabéns, chegou ao nível ${tier}! 🏅`,
        body1: `Já concluiu <strong>${deliveredCount}</strong> doações através da Wafina — obrigado por continuar a fazer a diferença na vida de quem mais precisa.`,
        body2: 'Como agradecimento, tem um presente à sua espera. Contacte-nos para combinar como recebê-lo.',
        footer: 'Recebeu este email porque tem as notificações por email ativadas nas definições da sua conta Wafina.',
      },
      en: {
        subject: `Wafina — Congratulations! You reached ${tier} tier 🏅`,
        heading: `Congratulations, you reached ${tier} tier! 🏅`,
        body1: `You've completed <strong>${deliveredCount}</strong> donations through Wafina — thank you for continuing to make a difference for people who need it most.`,
        body2: "As a thank-you, there's a gift waiting for you. Contact us to arrange how to receive it.",
        footer: 'You received this email because email notifications are enabled in your Wafina account settings.',
      },
    };
    const c = copy[locale];
    await sendEmail({
      to: donorEmail,
      subject: c.subject,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          ${EMAIL_LOGO_HTML}
          <h2 style="color: ${EMAIL_BRAND_COLOR};">${c.heading}</h2>
          <p style="color: #475569; line-height: 1.5;">${c.body1}</p>
          <p style="color: #475569; line-height: 1.5;">${c.body2}</p>
          <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">${c.footer}</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('sendMilestoneEmail failed (swallowed, does not fail the caller\'s action):', err);
  }
}

/**
 * Donor loyalty milestones (2026-08-17) — the single entry point donations.ts
 * calls right after each of the two "item delivered" flows (confirmDelivery,
 * confirmIndividualPickup). Checks whether this specific delivery just
 * crossed a new tier threshold and, if so, sends exactly one congratulations
 * email and records the new high-water mark (Users.Highest_Milestone_Notified)
 * so the same tier — or any lower one — is never emailed again. Swallows all
 * its own errors: a missed/failed milestone check must never fail the
 * delivery confirmation itself, same as every other lifecycle email here.
 */
export async function checkAndNotifyMilestone(donorId: string): Promise<void> {
  try {
    const donor = await findUserById(donorId);
    if (!donor?.Email) return;

    const deliveredCount = await countDeliveredDonationsForDonor(donorId);
    const alreadyNotified = donor.Highest_Milestone_Notified ? Number(donor.Highest_Milestone_Notified) : null;
    const newTier = getNewlyCrossedTier(deliveredCount, alreadyNotified);
    if (!newTier) return;

    if (donor.Email_Notifications_Enabled !== 'FALSE') {
      await sendMilestoneEmail(donor.Email, newTier, deliveredCount);
    }

    await updateRow(SHEET_TABS.users, 'User_ID', donorId, {
      Highest_Milestone_Notified: String(DONOR_TIER_THRESHOLDS[newTier]),
    });
  } catch (err) {
    console.error('checkAndNotifyMilestone failed (swallowed, does not fail the caller\'s action):', err);
  }
}
