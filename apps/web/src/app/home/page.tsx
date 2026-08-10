'use client';

import type { Donation, GeoRegion, Notification, Partner, SuccessStory } from '@wafina/shared';
import { useRouter } from 'next/navigation';
import { Button, Card, Icon, Photo, useToast } from '@wafina/ui';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/AppShell';
import { useAuth, useRequireSession } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';

/**
 * Full redesign, 2026-08-08 — parity with the mobile Home redesign (same
 * commit set): greeting header with a notifications bell, active country,
 * the donate CTA, a personal impact summary, quick actions, and the latest
 * impact story. Same data sources as mobile (donations/mine, notifications,
 * donor/success-stories) — nothing new on the backend, just surfaced here too.
 */
export default function HomePage() {
  const { t } = useTranslation();
  const session = useRequireSession();
  const { firebaseUser } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const [activeCountryName, setActiveCountryName] = useState<string | null>(null);
  const [donations, setDonations] = useState<Donation[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestStory, setLatestStory] = useState<SuccessStory | null>(null);
  const [partners, setPartners] = useState<Partner[] | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);

  useEffect(() => {
    if (!firebaseUser || !session?.activeCountryId) return;
    (async () => {
      try {
        const idToken = await firebaseUser.getIdToken();
        const countries = await apiFetch<GeoRegion[]>('/geo-regions/all-countries', { idToken });
        setActiveCountryName(countries.find((c) => c.Region_ID === session.activeCountryId)?.Name ?? null);
      } catch {
        // Non-critical — the banner just doesn't render if this fails.
      }
    })();
  }, [firebaseUser, session?.activeCountryId]);

  useEffect(() => {
    if (!firebaseUser) return;
    (async () => {
      try {
        const idToken = await firebaseUser.getIdToken();
        const [donationList, notifications, stories, partnerList] = await Promise.all([
          apiFetch<Donation[]>('/donations/mine', { idToken }),
          apiFetch<Notification[]>('/notifications', { idToken }),
          apiFetch<SuccessStory[]>('/donor/success-stories', { idToken }),
          apiFetch<Partner[]>('/partners', { idToken }),
        ]);
        setDonations(donationList);
        setUnreadCount(notifications.filter((n) => n.Status !== 'Read').length);
        setLatestStory(stories[0] ?? null);
        setPartners(partnerList);
      } catch {
        // Non-critical — Home's summary sections just stay empty if this fails.
      }
    })();
  }, [firebaseUser]);

  const stats = useMemo(() => {
    if (!donations) return null;
    const institutionIds = new Set(donations.map((d) => d.Claimed_By_Institution_ID).filter(Boolean));
    return {
      total: donations.length,
      institutions: institutionIds.size,
      quantity: donations.reduce((sum, d) => sum + (Number.isSafeInteger(d.Quantity) ? d.Quantity : 0), 0),
    };
  }, [donations]);

  if (!session) return null;

  const quickActions = [
    { key: 'donate', label: t('home.quickDonate'), icon: 'gift' as const, color: 'var(--color-cta)', bg: 'var(--color-cta-soft)', href: '/donations/new' },
    { key: 'impact', label: t('home.quickImpact'), icon: 'heart' as const, color: 'var(--danger-500)', bg: 'var(--danger-100)', href: '/impact' },
    { key: 'institutions', label: t('home.quickInstitutions'), icon: 'building' as const, color: 'var(--success-500)', bg: 'var(--success-100)', href: '/institutions' },
    { key: 'mine', label: t('home.quickMine'), icon: 'list' as const, color: 'var(--color-accent)', bg: 'var(--color-accent-soft)', href: '/donations' },
  ];

  return (
    <AppShell>
      <div className="stack" style={{ maxWidth: 560 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22 }}>{t('home.greeting')}{session.name ? `, ${session.name}` : ''} 👋</h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 13.5, marginTop: 2 }}>
              {t('home.thankYou')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push('/notifications')}
            aria-label={t('nav.notifications')}
            style={{
              position: 'relative',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 8,
              color: 'var(--color-text)',
            }}
          >
            <Icon name="bell" size={22} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  minWidth: 16,
                  height: 16,
                  borderRadius: 8,
                  background: 'var(--danger-500)',
                  color: '#fff',
                  fontSize: 9.5,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 3px',
                }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>

        {activeCountryName && (
          <Card
            className="stack"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, cursor: 'pointer' }}
            onClick={() => router.push('/settings')}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                background: 'var(--color-accent-soft)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-accent)',
                flexShrink: 0,
              }}
            >
              <Icon name="globe" size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 700 }}>{activeCountryName}</p>
              <p style={{ fontSize: 11.5, color: 'var(--color-text-faint)' }}>{t('home.activeCountry')}</p>
            </div>
            <span style={{ color: 'var(--color-text-faint)' }}>›</span>
          </Card>
        )}

        <div
          style={{
            background: 'var(--color-accent)',
            borderRadius: 20,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 36 }}>🎁</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 800, fontSize: 20, color: 'var(--color-accent-text)' }}>{t('home.donateNow')}</p>
              <p style={{ fontSize: 13, color: 'var(--color-accent-soft)' }}>{t('home.donateNowSubtitle')}</p>
            </div>
          </div>
          <Button
            onClick={() => router.push('/donations/new')}
            style={{ background: '#ffffff', color: 'var(--color-accent)', width: '100%', justifyContent: 'center' }}
          >
            {t('home.donateNowCta')}
          </Button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontWeight: 700, fontSize: 16 }}>{t('home.yourImpact')}</p>
          <button
            type="button"
            onClick={() => router.push('/donations')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent)', fontWeight: 600, fontSize: 13 }}
          >
            {t('home.viewAll')}
          </button>
        </div>
        {stats && (
          <div style={{ display: 'flex', gap: 12 }}>
            {[
              { icon: 'heart' as const, color: 'var(--color-cta)', bg: 'var(--color-cta-soft)', value: stats.total, label: t('home.donationsMade') },
              { icon: 'building' as const, color: 'var(--success-500)', bg: 'var(--success-100)', value: stats.institutions, label: t('home.institutionsSupported') },
              { icon: 'package' as const, color: 'var(--warning-500)', bg: 'var(--warning-100)', value: stats.quantity, label: t('home.itemsDonated') },
            ].map((s) => (
              <Card key={s.label} className="stack" style={{ flex: 1, gap: 4, padding: 12 }}>
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 999,
                    background: s.bg,
                    color: s.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 2,
                  }}
                >
                  <Icon name={s.icon} size={16} />
                </div>
                <p style={{ fontWeight: 800, fontSize: 20 }}>{s.value}</p>
                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.3 }}>{s.label}</p>
              </Card>
            ))}
          </div>
        )}

        <p style={{ fontWeight: 700, fontSize: 16 }}>{t('home.quickActions')}</p>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {quickActions.map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={() => router.push(action.href)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                width: 76,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 999,
                  background: action.bg,
                  color: action.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name={action.icon} size={20} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text)', textAlign: 'center' }}>
                {action.label}
              </span>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontWeight: 700, fontSize: 16 }}>{t('home.latestStories')}</p>
          <button
            type="button"
            onClick={() => router.push('/impact')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent)', fontWeight: 600, fontSize: 13 }}
          >
            {t('home.viewAllStories')}
          </button>
        </div>
        {latestStory && (
          <Card
            style={{ padding: 0, overflow: 'hidden', gap: 0, cursor: 'pointer' }}
            onClick={() => router.push('/impact')}
          >
            <Photo
              src={latestStory.Image}
              placeholderIcon="❤️"
              style={{ width: '100%', height: 180, objectFit: 'contain', background: 'var(--color-surface-2)' }}
            />
            <div className="stack" style={{ gap: 4, padding: 16 }}>
              <p style={{ fontWeight: 700, fontSize: 15.5 }}>{latestStory.Title}</p>
              {(latestStory.Institution_Name || latestStory.Item_Type) && (
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-accent)' }}>
                  {[latestStory.Item_Type, latestStory.Institution_Name].filter(Boolean).join(' · ')}
                </p>
              )}
              <p
                style={{
                  fontSize: 13,
                  color: 'var(--color-text-muted)',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                ❤️ {latestStory.Description}
              </p>
            </div>
          </Card>
        )}

        {partners && partners.length > 0 && (
          <>
            <div>
              <p style={{ fontWeight: 700, fontSize: 16 }}>{t('home.ourPartners')}</p>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>
                {t('home.partnersTagline')}
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {partners.map((p) => (
                <button
                  key={p.Partner_ID}
                  type="button"
                  onClick={() => setSelectedPartner(p)}
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 12,
                    padding: 12,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 72,
                  }}
                >
                  <Photo
                    src={p.Logo}
                    placeholderIcon="🤝"
                    style={{ maxWidth: '100%', maxHeight: 44, objectFit: 'contain' }}
                  />
                </button>
              ))}
            </div>
            <Card className="stack" style={{ gap: 8, alignItems: 'flex-start' }}>
              <p style={{ fontWeight: 700, fontSize: 15 }}>{t('home.becomePartner')}</p>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                {t('home.becomePartnerText')}
              </p>
              {/* Real-device finding, 2026-08-08 — a plain mailto: <a> gives zero
                  feedback when it fails (no mail app configured, or the browser
                  silently blocks the navigation), and there's no way for JS to
                  detect that failure to react to it. The unguarded
                  clipboard.writeText() this replaced had the same problem: it
                  can reject in a restricted context (no clipboard-write
                  permission, non-focused tab) and with no catch, the toast
                  after it never ran either — "click, nothing happens" either
                  way. A single button that always shows a toast no matter what
                  the clipboard call does, with mailto as a best-effort bonus
                  alongside it, guarantees the click is never silent. */}
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard
                    ?.writeText('wafina@zuinder.com')
                    .then(() => showToast('Email copiado: wafina@zuinder.com'))
                    .catch(() => showToast('Contacte-nos: wafina@zuinder.com'));
                  window.location.href = 'mailto:wafina@zuinder.com?subject=Parceria%20com%20a%20Wafina';
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  color: 'var(--color-accent)',
                  fontWeight: 700,
                  fontSize: 13.5,
                }}
              >
                {t('home.becomePartnerCta')}
              </button>
            </Card>
          </>
        )}
      </div>

      {selectedPartner && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedPartner(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="stack"
            style={{
              background: 'var(--color-surface)',
              borderRadius: 16,
              padding: 24,
              maxWidth: 400,
              width: '100%',
              gap: 12,
            }}
          >
            <Photo
              src={selectedPartner.Logo}
              placeholderIcon="🤝"
              style={{ maxWidth: '100%', maxHeight: 64, objectFit: 'contain', alignSelf: 'flex-start' }}
            />
            <p style={{ fontWeight: 800, fontSize: 18 }}>{selectedPartner.Name}</p>
            <p style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>{selectedPartner.Description}</p>
            {selectedPartner.Website && (
              <a
                href={selectedPartner.Website}
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--color-accent)', fontWeight: 700, fontSize: 13.5 }}
              >
                {t('home.visitWebsite')}
              </a>
            )}
            <Button variant="ghost" onClick={() => setSelectedPartner(null)}>
              {t('home.close')}
            </Button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
