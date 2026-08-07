import localFont from 'next/font/local';

export const manrope = localFont({
  src: [
    { path: './manrope-400.ttf', weight: '400', style: 'normal' },
    { path: './manrope-600.ttf', weight: '600', style: 'normal' },
    { path: './manrope-700.ttf', weight: '700', style: 'normal' },
    { path: './manrope-800.ttf', weight: '800', style: 'normal' },
  ],
  variable: '--font-body',
  display: 'swap',
});

export const plusJakartaSans = localFont({
  src: [{ path: './plusjakartasans-600.ttf', weight: '600', style: 'normal' }],
  variable: '--font-tagline',
  display: 'swap',
});

export const plexMono = localFont({
  src: [{ path: './plexmono-400.ttf', weight: '400', style: 'normal' }],
  variable: '--font-mono',
  display: 'swap',
});
