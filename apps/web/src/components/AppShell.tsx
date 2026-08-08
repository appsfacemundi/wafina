'use client';

import type { Notification } from '@wafina/shared';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { SwitchCountryPrompt } from '@/components/SwitchCountryPrompt';
import { setLanguage } from '@/i18n';
import { SUPPORTED_LANGUAGES } from '@/i18n/languages';
import { Button, Icon, LanguageSwitcher, type IconName } from '@wafina/ui';

const NAV_ITEMS: { href: string; labelKey: string; icon: IconName }[] = [
  { href: '/home', labelKey: 'nav.home', icon: 'home' },
  { href: '/donations/new', labelKey: 'nav.donate', icon: 'gift' },
  { href: '/donations', labelKey: 'nav.myDonations', icon: 'list' },
  { href: '/impact', labelKey: 'nav.impactStories', icon: 'heart' },
  { href: '/institutions', labelKey: 'nav.institutions', icon: 'building' },
  { href: '/notifications', labelKey: 'nav.notifications', icon: 'bell' },
  { href: '/settings', labelKey: 'nav.settings', icon: 'settings' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { firebaseUser, signOutUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const { t, i18n } = useTranslation();

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LanguageSwitcher
              languages={SUPPORTED_LANGUAGES}
              value={i18n.language}
              onChange={setLanguage}
              label={t('language.choose')}
            />
            <Button variant="ghost" onClick={() => signOutUser()}>
              {t('common.signOut')}
            </Button>
          </div>
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
              {t(item.labelKey)}
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
