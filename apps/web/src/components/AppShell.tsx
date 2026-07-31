'use client';

import type { Notification } from '@wafina/shared';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { SwitchCountryPrompt } from '@/components/SwitchCountryPrompt';
import { Button } from '@wafina/ui';

const NAV_ITEMS = [
  { href: '/home', label: 'Início' },
  { href: '/donations/new', label: 'Doar' },
  { href: '/donations', label: 'Minhas Doações' },
  { href: '/impact', label: 'Histórias de Impacto' },
  { href: '/institutions', label: 'Instituições' },
  { href: '/notifications', label: 'Notificações' },
  { href: '/settings', label: 'Definições' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { firebaseUser, signOutUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!firebaseUser) return;
    (async () => {
      try {
        const idToken = await firebaseUser.getIdToken();
        const notifications = await apiFetch<Notification[]>('/notifications', { idToken });
        setUnreadCount(notifications.filter((n) => n.Status !== 'Read').length);
      } catch {
        // Non-critical — the badge just stays at its last known count.
      }
    })();
  }, [firebaseUser, pathname]);

  return (
    <div>
      <SwitchCountryPrompt />
      <header className="app-topbar">
        <div className="app-topbar-row">
          <span className="app-mark">
            <span className="app-mark-dot" />
            Wafina
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
              {item.href === '/notifications' && unreadCount > 0 && (
                <span className="nav-badge">{unreadCount}</span>
              )}
            </button>
          ))}
        </nav>
      </header>
      <main className="app-content">{children}</main>
    </div>
  );
}
