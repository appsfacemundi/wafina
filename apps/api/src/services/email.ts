import { env } from '../config/env';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

/**
 * Brand consistency fix, 2026-08-12 — lifecycle emails were still using
 * `#ff5a36` and no logo, left over from before the brand redesign to the
 * bougainvillea (`#ad1a67`) heart mark used everywhere else (app icons,
 * store listings). Centralized here so every email template stays in sync
 * with the actual current icon (`apps/mobile-donor/assets/icon.png`, not
 * the older illustrated mark) instead of each call site drifting separately.
 */
export const EMAIL_BRAND_COLOR = '#ad1a67';

export const EMAIL_LOGO_HTML = `
  <div style="text-align: center; margin-bottom: 24px;">
    <img src="https://wafina-donor-web.onrender.com/wafina-email-logo.png" alt="Wafina" width="56" height="56" style="border-radius: 14px; display: inline-block;" />
  </div>
`;

/**
 * Security fix, 2026-08-28 — hoisted here from donations.ts (its original,
 * only prior use) so success-stories.ts can share it too: institution-authored
 * free text (success story Title/Description) was being interpolated raw into
 * the donor-facing email, unlike donations.ts's receiver thank-you message,
 * which already went through this same escaping. Any caller building email
 * HTML from user-supplied free text (not a fixed picklist/enum value) should
 * escape it with this first.
 */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Notification preferences module, 2026-08-08 — the only email-sending path
 * in the app. Uses Resend's REST API directly (no SDK) to avoid a new
 * dependency for a single POST call. Failures are swallowed (logged, not
 * thrown), matching createNotification's own philosophy: the donor already
 * got their in-app notification, so a missed email is a strictly better
 * failure mode than turning an unrelated action (publishing a story) into a
 * 500. No-ops with a warning until RESEND_API_KEY is configured, so the rest
 * of the app keeps working before that key exists.
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  if (!env.email.resendApiKey) {
    console.warn(`sendEmail skipped (RESEND_API_KEY not configured): would have sent "${input.subject}" to ${input.to}`);
    return;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.email.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.email.fromAddress,
        to: input.to,
        subject: input.subject,
        html: input.html,
      }),
    });
    if (!res.ok) {
      console.error('sendEmail failed:', res.status, await res.text());
    }
  } catch (err) {
    console.error('sendEmail failed (swallowed, does not fail the caller\'s action):', err);
  }
}
