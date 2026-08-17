import { DONOR_TIERS, type DonorTier } from '../enums/donor-tier';

/**
 * Donor loyalty milestones (2026-08-17) — stakeholder-approved thresholds,
 * counted against Delivered donations only (not every submission — a
 * milestone should mean the item actually reached someone, matching the
 * feature's own "you've made a real difference" framing). Centralized here
 * so mobile (display) and API (email trigger) can never drift apart on what
 * "reaching Gold" actually means.
 */
export const DONOR_TIER_THRESHOLDS: Record<DonorTier, number> = {
  Bronze: 5,
  Silver: 10,
  Gold: 25,
  Platinum: 50,
};

export interface DonorTierProgress {
  deliveredCount: number;
  /** Null when the donor hasn't reached Bronze yet. */
  currentTier: DonorTier | null;
  /** Null when currentTier is already Platinum — nothing further to reach. */
  nextTier: DonorTier | null;
  nextThreshold: number | null;
  remainingToNextTier: number | null;
}

/** Client-display use (HomeScreen) — purely a read of already-known Delivered count, no server round-trip needed. */
export function getDonorTierProgress(deliveredCount: number): DonorTierProgress {
  let currentTier: DonorTier | null = null;
  for (const tier of DONOR_TIERS) {
    if (deliveredCount >= DONOR_TIER_THRESHOLDS[tier]) currentTier = tier;
  }
  const currentIndex = currentTier ? DONOR_TIERS.indexOf(currentTier) : -1;
  const nextTier = currentIndex + 1 < DONOR_TIERS.length ? DONOR_TIERS[currentIndex + 1] : null;
  const nextThreshold = nextTier ? DONOR_TIER_THRESHOLDS[nextTier] : null;
  return {
    deliveredCount,
    currentTier,
    nextTier,
    nextThreshold,
    remainingToNextTier: nextThreshold !== null ? Math.max(0, nextThreshold - deliveredCount) : null,
  };
}

/**
 * Server-side use only (donor-tiers.ts) — the single highest tier crossed
 * since `alreadyNotifiedThreshold`, so a donor who somehow jumps two tiers
 * between checks (e.g. several deliveries confirmed in quick succession)
 * gets exactly one congratulations email, for the highest tier reached, not
 * one per skipped tier. Null when no new tier has been crossed.
 */
export function getNewlyCrossedTier(deliveredCount: number, alreadyNotifiedThreshold: number | null): DonorTier | null {
  const floor = alreadyNotifiedThreshold ?? 0;
  let result: DonorTier | null = null;
  for (const tier of DONOR_TIERS) {
    const threshold = DONOR_TIER_THRESHOLDS[tier];
    if (deliveredCount >= threshold && threshold > floor) result = tier;
  }
  return result;
}
