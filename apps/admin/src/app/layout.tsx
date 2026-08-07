import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/components/ToastProvider';
import { manrope, plexMono, plusJakartaSans } from '@/fonts';
import './globals.css';

export const metadata: Metadata = {
  title: 'Wafina Admin',
  description: 'Wafina — painel de administração',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt" className={`${manrope.variable} ${plusJakartaSans.variable} ${plexMono.variable}`}>
      <body>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
