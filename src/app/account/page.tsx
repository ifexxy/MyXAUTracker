'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { UserData } from '@/types';
import Footer from '@/components/Footer';

export default function AccountPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!authLoading && !user && mounted) router.push('/login');
  }, [user, authLoading, mounted, router]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const fb = getFirebase();
        const snap = await getDoc(doc(fb.db, 'users', user.uid));
        if (snap.exists()) setUserData(snap.data() as UserData);
      } catch {}
    })();
  }, [user]);

  if (!mounted || authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60dvh' }}>
        <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 24, color: 'var(--ink-3)' }} />
      </div>
    );
  }

  if (!user) return null;

  const now = Date.now();
  const trialExpiry    = userData?.trialEndsAt            ? new Date(userData.trialEndsAt)            : null;
  const subExpiry      = userData?.currentPeriodEnd       ? new Date(userData.currentPeriodEnd)       : null;
  const manualExpiry   = userData?.manualAccessExpiresAt  ? new Date(userData.manualAccessExpiresAt)  : null;

  const hasAccess = userData ? (
    (trialExpiry && trialExpiry.getTime() > now) ||
    (userData.subscriptionStatus === 'active' && subExpiry && subExpiry.getTime() > now) ||
    (userData.manualAccess && (!manualExpiry || manualExpiry.getTime() > now))
  ) : false;

  const statusLabel =
    userData?.subscriptionStatus === 'active' ? 'Active Subscription' :
    userData?.subscriptionStatus === 'trial'  ? '7-Day Free Trial'    :
    userData?.manualAccess                    ? 'Access Granted'      :
    'No Active Plan';

  const statusColor =
    userData?.subscriptionStatus === 'active' ? 'var(--green)' :
    userData?.subscriptionStatus === 'trial'  ? 'var(--gold)'  :
    userData?.manualAccess                    ? 'var(--green)' :
    'var(--red)';

  const statusBg =
    userData?.subscriptionStatus === 'active' ? 'var(--green-bg)' :
    userData?.subscriptionStatus === 'trial'  ? 'var(--gold-bg)'  :
    userData?.manualAccess                    ? 'var(--green-bg)' :
    'var(--red-bg)';

  const expiryDate =
    userData?.subscriptionStatus === 'active' && subExpiry
      ? subExpiry.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
      : userData?.subscriptionStatus === 'trial' && trialExpiry
        ? trialExpiry.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
        : manualExpiry
          ? manualExpiry.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
          : null;

  const instruments = [
    {
      href:   '/predict',
      emoji:  '🥇',
      label:  'Gold',
      sub:    'XAU/USD',
      color:  'var(--gold)',
      bg:     'var(--gold-bg)',
      border: 'rgba(154,110,0,0.22)',
    },
    {
      href:   '/predict/bitcoin',
      emoji:  '₿',
      label:  'Bitcoin',
      sub:    'BTC/USD',
      color:  '#f7921a',
      bg:     'rgba(247,146,26,0.1)',
      border: 'rgba(247,146,26,0.25)',
    },
    {
      href:   '/predict/usdchf',
      emoji:  '🇨🇭',
      label:  'USD/CHF',
      sub:    'Forex',
      color:  'var(--green)',
      bg:     'var(--green-bg)',
      border: 'rgba(0,212,143,0.22)',
    },
  ];

  return (
    <>
      <section style={{ padding: '36px 20px 18px' }}>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 6 }}>Account Dashboard</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.2, letterSpacing: -0.5 }}>
          Welcome, <span style={{ color: 'var(--gold)' }}>{user.email}</span>
        </h1>
      </section>

      {/* Account Status */}
      <div style={{ margin: '0 16px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '16px 16px 0', borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
            Account Status
          </div>

          {/* Status badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            background: statusBg, border: `1px solid ${statusColor}33`,
            color: statusColor, fontSize: 11, fontWeight: 700, padding: '5px 13px',
            borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12,
          }}>
            <i className="fa-solid fa-circle" style={{ fontSize: 6 }} />
            {statusLabel}
          </div>

          {/* Info rows */}
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', background: 'var(--bg-2)', borderRadius: 9 }}>
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Email</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', background: 'var(--bg-2)', borderRadius: 9 }}>
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Plan</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: statusColor }}>{statusLabel}</span>
            </div>

            {expiryDate && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', background: 'var(--bg-2)', borderRadius: 9 }}>
                <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                  {userData?.subscriptionStatus === 'active' ? 'Renews' : 'Expires'}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{expiryDate}</span>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', background: 'var(--bg-2)', borderRadius: 9 }}>
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Access</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: hasAccess ? 'var(--green)' : 'var(--red)' }}>
                {hasAccess ? 'Full access' : 'Expired'}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding: '12px 16px', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {!hasAccess || userData?.subscriptionStatus !== 'active' ? (
            <Link href="/contact" style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 7, padding: '11px 0', background: 'var(--ink)', color: 'var(--bg)',
              fontWeight: 700, fontSize: 13, borderRadius: 8, textDecoration: 'none', minWidth: 120,
            }}>
              <i className="fa-solid fa-envelope" /> Contact Us
            </Link>
          ) : (
            <Link href="/subscribe" style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 7, padding: '11px 0', background: 'var(--gold)', color: '#000',
              fontWeight: 700, fontSize: 13, borderRadius: 8, textDecoration: 'none', minWidth: 120,
            }}>
              <i className="fa-solid fa-crown" /> Renew
            </Link>
          )}
          <button
            onClick={signOut}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 7, padding: '11px 0', background: 'transparent', color: 'var(--ink-2)',
              fontWeight: 600, fontSize: 13, borderRadius: 8, cursor: 'pointer',
              border: '1px solid var(--border)', minWidth: 120,
            }}
          >
            <i className="fa-solid fa-right-from-bracket" /> Sign Out
          </button>
        </div>
      </div>

      {/* What are we analysing today */}
      <div style={{ margin: '0 16px 14px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>
          What are we analysing today?
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {instruments.map((inst) => (
            <Link
              key={inst.href}
              href={inst.href}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 16px', background: 'var(--bg)',
                border: `1px solid ${inst.border}`,
                borderRadius: 12, textDecoration: 'none',
                transition: 'background 0.15s',
              }}
            >
              <div style={{
                width: 42, height: 42, borderRadius: 10, background: inst.bg,
                border: `1px solid ${inst.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, flexShrink: 0,
              }}>
                {inst.emoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{inst.label}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{inst.sub} · Forecast & Signals</div>
              </div>
              <i className="fa-solid fa-chevron-right" style={{ fontSize: 12, color: 'var(--ink-4)', flexShrink: 0 }} />
            </Link>
          ))}
        </div>
      </div>

      <Footer />
    </>
  );
}
