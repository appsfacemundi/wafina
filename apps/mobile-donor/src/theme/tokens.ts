/** Design tokens — ported from apps/web/src/app/globals.css (Wafina Design System, Module 4b). */

export const palette = {
  bougainvillea50: '#fbf1f6',
  bougainvillea100: '#f5dce9',
  bougainvillea300: '#e495c0',
  bougainvillea400: '#c23e86',
  bougainvillea500: '#ad1a67',
  bougainvillea600: '#8f1455',
  bougainvillea700: '#710f44',

  palm50: '#eaf6f2',
  palm100: '#cbeadf',
  palm300: '#6fbba3',
  palm500: '#0f6e5c',
  palm600: '#0b5949',
  palm700: '#084538',

  dusk25: '#fbf9fa',
  dusk50: '#f5f1f3',
  dusk100: '#ebe3e7',
  dusk200: '#d9ccd3',
  dusk300: '#c2aeb8',
  dusk500: '#8a7482',
  dusk600: '#6b5762',
  dusk700: '#4a3b44',
  dusk800: '#332830',
  dusk900: '#241a20',
  dusk950: '#181117',

  success100: '#dcf1e7',
  success500: '#2a9d6f',
  success700: '#1c6e4d',
  warning100: '#f6e7d2',
  warning500: '#c97a1f',
  warning700: '#8f5615',
  danger100: '#f6dcdc',
  danger500: '#c23b3b',
  danger700: '#8a2a2a',
  info100: '#dceaf4',
  info500: '#2e6fa3',
  info700: '#1f4e75',
};

export const colors = {
  bg: palette.dusk25,
  surface: '#ffffff',
  surface2: palette.dusk50,
  border: palette.dusk200,
  borderStrong: palette.dusk300,
  text: palette.dusk900,
  textMuted: palette.dusk600,
  textFaint: palette.dusk500,
  accent: palette.bougainvillea500,
  accentHover: palette.bougainvillea600,
  accentSoft: palette.bougainvillea50,
  accentText: '#ffffff',
  secondary: palette.palm500,
  secondaryHover: palette.palm600,
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
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const fonts = {
  display: 'Fraunces-600',
  displayItalic: 'Fraunces-Italic-400',
  body: 'WorkSans-400',
  bodyMedium: 'WorkSans-600',
  bodyBold: 'WorkSans-700',
  mono: 'PlexMono-400',
};
