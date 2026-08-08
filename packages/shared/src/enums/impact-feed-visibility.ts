/**
 * Governs which Success Stories a donor sees in their Impact feed (Home's
 * "Últimas histórias" and the Impact tab). Private (default): only stories
 * about the donor's own donations. Public: every Admin-approved story
 * platform-wide, so a donor can see the impact of other people's donations
 * too. Either way, only Approved stories are ever shown — this setting picks
 * the pool, never bypasses the approval gate itself.
 */
export const IMPACT_FEED_VISIBILITIES = ['Private', 'Public'] as const;
export type ImpactFeedVisibility = (typeof IMPACT_FEED_VISIBILITIES)[number];
