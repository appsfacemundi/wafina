'use client';

import { Button, Icon, type IconName } from '@wafina/ui';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';

const NAV_ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: '/home', label: 'Início', icon: 'home' },
  { href: '/donations/available', label: 'Doações Disponíveis', icon: 'inbox' },
  { href: '/donations/claimed', label: 'Doações Aceites', icon: 'check-circle' },
  { href: '/success-stories', label: 'Histórias de Impacto', icon: 'heart' },
  { href: '/disputes', label: 'Ocorrências', icon: 'alert-circle' },
  { href: '/notifications', label: 'Notificações', icon: 'bell' },
  { href: '/settings', label: 'Definições', icon: 'settings' },
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
            Wafina Instituição
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
              <Icon name={item.icon} size={16} />
              {item.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="app-content">{children}</main>
    </div>
  );
}
