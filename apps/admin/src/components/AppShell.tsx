'use client';

import { Button } from '@wafina/ui';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';

const NAV_ITEMS = [
  { href: '/home', label: 'Instituições Pendentes' },
  { href: '/donations', label: 'Doações' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { signOutUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div>
      <header className="app-topbar">
        <div className="app-topbar-row">
          <span className="app-mark">
            <span className="app-mark-dot" />
            Wafina Admin
          </span>
          <Button variant="ghost" onClick={() => signOutUser()}>
            Sair
          </Button>
        </div>
        <nav className="app-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.href}
              type="button"
              className={`app-nav-link${pathname === item.href ? ' active' : ''}`}
              onClick={() => router.push(item.href)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="app-content">{children}</main>
    </div>
  );
}
