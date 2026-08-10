/**
 * RC1 RECEBER — Admin-facing computed state for Recipient_Category==='People'
 * donations. Never stored: derived at read time from Approval_Status,
 * Reserved_By_User_ID/Reserved_At (with 24h lazy expiry), and Status. Null on
 * every non-People donation, where this state doesn't apply.
 */
export const INDIVIDUAL_DONATION_STATES = ['Available', 'Reserved', 'Delivered'] as const;
export type IndividualDonationState = (typeof INDIVIDUAL_DONATION_STATES)[number];
