import localFont from 'next/font/local';

export const fraunces = localFont({
  src: [
    { path: './fraunces-600.ttf', weight: '600', style: 'normal' },
    { path: './fraunces-italic-400.ttf', weight: '400', style: 'italic' },
  ],
  variable: '--font-display',
  display: 'swap',
});

export const workSans = localFont({
  src: [
    { path: './worksans-400.ttf', weight: '400', style: 'normal' },
    { path: './worksans-600.ttf', weight: '600', style: 'normal' },
    { path: './worksans-700.ttf', weight: '700', style: 'normal' },
  ],
  variable: '--font-body',
  display: 'swap',
});

export const plexMono = localFont({
  src: [{ path: './plexmono-400.ttf', weight: '400', style: 'normal' }],
  variable: '--font-mono',
  display: 'swap',
});
