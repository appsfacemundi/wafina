'use client';

import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from './ui/Button';

const NAV_ITEMS = [
  { href: '/home', label: 'Início' },
  { href: '/donations/new', label: 'Doar' },
  { href: '/donations', label: 'Minhas Doações' },
  { href: '/institutions', label: 'Instituições' },
  { href: '/settings', label: 'Definições' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { signOutUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div>
      <header className="app-topbar">
        <span className="app-mark">
          <span className="app-mark-dot" />
          Wafina
        </span>
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
        <Button variant="ghost" onClick={() => signOutUser()}>
          Sair
        </Button>
      </header>
      <main className="app-content">{children}</main>
    </div>
  );
}
