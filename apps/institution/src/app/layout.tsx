import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { fraunces, plexMono, workSans } from '@/fonts';
import './globals.css';

export const metadata: Metadata = {
  title: 'Wafina Instituição',
  description: 'Wafina — plataforma para instituições parceiras',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt" className={`${fraunces.variable} ${workSans.variable} ${plexMono.variable}`}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
