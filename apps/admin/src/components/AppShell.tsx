'use client';

import type { AdminDonationView } from '@wafina/shared';
import { Button, Icon, LanguageSwitcher, type IconName } from '@wafina/ui';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { setLanguage } from '@/i18n';
import { SUPPORTED_LANGUAGES } from '@/i18n/languages';
import { apiFetch } from '@/lib/api';

const NAV_ITEMS: { href: string; labelKey: string; icon: IconName }[] = [
  { href: '/home', labelKey: 'nav.dashboard', icon: 'home' },
  // RC1 admin approval-gate rework, 2026-08-10 — its own top-level, badged
  // nav item (not folded into the general "Doações" list) so Admin never has
  // to go looking for where donation approval lives.
  { href: '/donations/approve', labelKey: 'nav.approveDonations', icon: 'check-circle' },
  { href: '/institutions', labelKey: 'nav.institutions', icon: 'building' },
  { href: '/donations', labelKey: 'nav.donations', icon: 'package' },
  { href: '/success-stories', labelKey: 'nav.impactStories', icon: 'heart' },
  { href: '/change-requests', labelKey: 'nav.changeRequests', icon: 'refresh' },
  { href: '/users', labelKey: 'nav.users', icon: 'users' },
  { href: '/countries', labelKey: 'nav.countries', icon: 'globe' },
  { href: '/disputes', labelKey: 'nav.disputes', icon: 'alert-circle' },
  { href: '/companies', labelKey: 'nav.companies', icon: 'briefcase' },
  { href: '/partners', labelKey: 'nav.partners', icon: 'shield-check' },
  { href: '/notifications', labelKey: 'nav.notifications', icon: 'bell' },
  { href: '/insights', labelKey: 'nav.insights', icon: 'globe' },
  { href: '/reports', labelKey: 'nav.reports', icon: 'bar-chart' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { firebaseUser, signOutUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { t, i18n } = useTranslation();
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);

  // RC1 admin approval-gate rework, 2026-08-10 — refetched on every route
  // change (not just once) so approving/rejecting a donation on the queue
  // page is reflected in the nav badge without a full reload.
  useEffect(() => {
    if (!firebaseUser) return;
    (async () => {
      try {
        const idToken = await firebaseUser.getIdToken();
        const pending = await apiFetch<AdminDonationView[]>('/donations/pending-review', { idToken });
        setPendingApprovalCount(pending.length);
      } catch {
        // Non-critical — the badge just stays at its last known count.
      }
    })();
  }, [firebaseUser, pathname]);

  return (
    <div>
      <header className="app-topbar">
        <div className="app-topbar-row">
          <span className="app-mark">
            <span className="app-mark-dot" />
            Wafina Admin
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LanguageSwitcher
              languages={SUPPORTED_LANGUAGES}
              value={i18n.language}
              onChange={setLanguage}
              label={t('language.choose')}
            />
            <Button
              variant="ghost-danger"
              onClick={() => {
                if (window.confirm(t('common.confirmSignOut'))) signOutUser();
              }}
            >
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
              {item.href === '/donations/approve' && pendingApprovalCount > 0 && (
                <span className="nav-badge nav-badge-warning">{pendingApprovalCount}</span>
              )}
            </button>
          ))}
        </nav>
      </header>
      <main className="app-content">{children}</main>
    </div>
  );
}
