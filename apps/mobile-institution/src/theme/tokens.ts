/** Design tokens — Wafina Brand Identity redesign, 2026-08-07 (stakeholder brief). */

export const palette = {
  blue50: '#eff6ff',
  blue100: '#dbeafe',
  blue300: '#93c5fd',
  blue500: '#0057d9',
  blue600: '#0046ad',
  blue700: '#003580',

  coral50: '#fff1ed',
  coral100: '#ffe0d6',
  coral500: '#ff5a36',
  coral600: '#e6431f',
  coral700: '#b83417',

  success100: '#dcfce7',
  success500: '#22c55e',
  success700: '#15803d',

  slate25: '#f8fafc',
  slate50: '#f1f5f9',
  slate100: '#e2e8f0',
  slate200: '#cbd5e1',
  slate300: '#94a3b8',
  slate500: '#64748b',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1e293b',
  slate900: '#0f172a',

  warning100: '#fef3c7',
  warning500: '#d97706',
  warning700: '#92400e',
  danger100: '#fee2e2',
  danger500: '#dc2626',
  danger700: '#991b1b',
  info100: '#dbeafe',
  info500: '#0057d9',
  info700: '#003580',
};

export const colors = {
  bg: palette.slate25,
  surface: '#ffffff',
  surface2: palette.slate50,
  border: palette.slate100,
  borderStrong: palette.slate200,
  text: palette.slate800,
  textMuted: palette.slate600,
  textFaint: palette.slate500,
  accent: palette.blue500,
  accentHover: palette.blue600,
  accentSoft: palette.blue50,
  accentText: '#ffffff',
  // Donation-specific CTAs only ("Doar agora") — kept distinct from accent
  // (blue, general primary actions) so coral stays meaningful as giving.
  cta: palette.coral500,
  ctaHover: palette.coral600,
  ctaSoft: palette.coral50,
  ctaText: '#ffffff',
  secondary: palette.slate700,
  secondaryHover: palette.slate800,
  danger: palette.danger500,
  dangerSoft: palette.danger100,
  success: palette.success500,
  successSoft: palette.success100,
  warning: palette.warning500,
  warningSoft: palette.warning100,
  info: palette.info500,
  infoSoft: palette.info100,
};

export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 20,
  xl: 24,
  full: 999,
};

export const fonts = {
  display: 'Manrope-800',
  body: 'Manrope-400',
  bodyMedium: 'Manrope-600',
  bodyBold: 'Manrope-700',
  // Supporting/tagline text only (e.g. "Smart Donations. Real Impact."
  // under a screen title) — not a general-purpose body font.
  tagline: 'PlusJakartaSans-600',
  mono: 'PlexMono-400',
};
