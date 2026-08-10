'use client';

import type { Notification } from '@wafina/shared';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';
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
  // RC1 UX addition, 2026-08-10 — dismissible floating WhatsApp contact
  // link. Deliberately session-only (component state, no persistence): a
  // fresh page load/app restart always shows it again, closing it just
  // clears it for the current visit.
  const [whatsappDismissed, setWhatsappDismissed] = useState(false);
  // Draggable position — null means "use the default bottom-right CSS
  // corner"; once dragged, pins to an explicit pixel position instead.
  const [whatsappPos, setWhatsappPos] = useState<{ x: number; y: number } | null>(null);
  const whatsappWrapRef = useRef<HTMLDivElement>(null);
  const whatsappJustDraggedRef = useRef(false);

  function onWhatsappDragEnd(e: DragEvent<HTMLDivElement>) {
    // clientX/Y land at (0,0) when the drag is cancelled or dropped outside
    // the viewport — treat that as "no move" rather than snapping to the
    // corner.
    if (e.clientX === 0 && e.clientY === 0) return;
    const width = whatsappWrapRef.current?.offsetWidth ?? 52;
    const height = whatsappWrapRef.current?.offsetHeight ?? 52;
    const x = Math.min(Math.max(0, e.clientX - width / 2), window.innerWidth - width);
    const y = Math.min(Math.max(0, e.clientY - height / 2), window.innerHeight - height);
    setWhatsappPos({ x, y });
    whatsappJustDraggedRef.current = true;
    setTimeout(() => {
      whatsappJustDraggedRef.current = false;
    }, 0);
  }

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
            <Button variant="ghost-danger" onClick={() => signOutUser()}>
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
      {!whatsappDismissed && (
        <div
          ref={whatsappWrapRef}
          className="whatsapp-float-wrap"
          draggable
          onDragEnd={onWhatsappDragEnd}
          style={whatsappPos ? { left: whatsappPos.x, top: whatsappPos.y, right: 'auto', bottom: 'auto' } : undefined}
        >
          <a
            href="https://wa.me/351930935925"
            target="_blank"
            rel="noopener noreferrer"
            className="whatsapp-float"
            aria-label="Contactar via WhatsApp"
            onClick={(e) => {
              if (whatsappJustDraggedRef.current) e.preventDefault();
            }}
          >
            <svg viewBox="0 0 24 24" width="19" height="19" fill="#ffffff" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.472-.148-.67.15-.198.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
              <path d="M12.004 2C6.486 2 2 6.486 2 12.004c0 1.9.53 3.744 1.53 5.343L2 22l4.79-1.503A9.96 9.96 0 0 0 12.004 22C17.522 22 22 17.522 22 12.004 22 6.486 17.522 2 12.004 2zm0 18.13a8.1 8.1 0 0 1-4.135-1.13l-.297-.176-2.845.893.905-2.78-.194-.298A8.106 8.106 0 0 1 3.9 12.004c0-4.472 3.632-8.104 8.104-8.104 4.472 0 8.104 3.632 8.104 8.104 0 4.472-3.632 8.126-8.104 8.126z" />
            </svg>
          </a>
          <button
            type="button"
            className="whatsapp-float-close"
            aria-label="Ocultar atalho do WhatsApp"
            onClick={() => {
              if (whatsappJustDraggedRef.current) return;
              setWhatsappDismissed(true);
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
