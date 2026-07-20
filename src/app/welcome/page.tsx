'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { UserData } from '@/types';
import Footer from '@/components/Footer';

export default function WelcomePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
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
  const trialExpiry = userData?.trialEndsAt ? new Date(userData.trialEndsAt) : null;
  const subExpiry = userData?.currentPeriodEnd ? new Date(userData.currentPeriodEnd) : null;
  const manualExpiry = userData?.manualAccessExpiresAt ? new Date(userData.manualAccessExpiresAt) : null;

  const hasAccess = userData ? (
    (trialExpiry && trialExpiry.getTime() > now) ||
    (userData.subscriptionStatus === 'active' && subExpiry && subExpiry.getTime() > now) ||
    (userData.manualAccess && (!manualExpiry || manualExpiry.getTime() > now))
  ) : false;

  const statusLabel =
    userData?.subscriptionStatus === 'active' ? 'Active Subscription' :
    userData?.subscriptionStatus === 'trial'  ? '3-Day Free Trial'    :
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

  return (
    <>
      <section style={{ padding: '40px 20px 24px', textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          background: 'var(--green-bg)', border: '1px solid rgba(0,212,143,0.22)',
          color: 'var(--green)', fontSize: 11, fontWeight: 700, padding: '5px 14px',
          borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 18,
        }}>
          <i className="fa-solid fa-circle-check" style={{ fontSize: 10 }} />
          Registration Successful
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.2, letterSpacing: -0.8, marginBottom: 10 }}>
          Thanks for Registering<span style={{ color: 'var(--gold)' }}>.</span>
        </h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.65, maxWidth: 320, margin: '0 auto' }}>
          Your account is ready. Here&apos;s a summary of what you have access to.
        </p>
      </section>

      {/* Welcome Dashboard */}
      <div style={{ margin: '0 16px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', marginBottom: 14 }}>
        {/* Top accent strip */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, transparent, var(--gold), transparent)' }} />

        <div style={{ padding: '20px 18px' }}>
          {/* Avatar + email */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'var(--gold-bg)', border: '2px solid var(--gold)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, fontSize: 20, color: 'var(--gold)',
            }}>
              <i className="fa-solid fa-user" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                Signed in as
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.email}
              </div>
            </div>
          </div>

          {/* Status card */}
          <div style={{
            background: statusBg,
            border: `1px solid ${statusColor}33`,
            borderRadius: 12, padding: '14px 16px', marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: statusColor, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Subscription Status
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '3px 10px',
                borderRadius: 20, background: statusColor + '22', color: statusColor,
                border: `1px solid ${statusColor}44`,
              }}>
                {statusLabel}
              </span>
            </div>
            {expiryDate ? (
              <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>
                {userData?.subscriptionStatus === 'active'
                  ? <>Your subscription renews on <strong style={{ color: 'var(--ink)' }}>{expiryDate}</strong>.</>
                  : userData?.subscriptionStatus === 'trial'
                    ? <>Your free trial expires on <strong style={{ color: 'var(--ink)' }}>{expiryDate}</strong>. Enjoy full access until then.</>
                    : <>Your access expires on <strong style={{ color: 'var(--ink)' }}>{expiryDate}</strong>.</>
                }
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>
                {userData?.manualAccess ? 'Permanent access has been granted to your account.' : 'No active plan found. Contact us to get access.'}
              </div>
            )}
          </div>

          {/* What's included */}
          <div style={{ background: 'var(--bg-2)', borderRadius: 10, padding: '12px 14px', marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              What&apos;s Included
            </div>
            {[
              { icon: 'fa-coins',       text: 'Real-time XAU/USD gold price feed'              },
              { icon: 'fa-bolt',        text: 'Entry signals for 10M, 1H, 4H & 24H'            },
              { icon: 'fa-chart-line',  text: 'ATR-based price forecasts across timeframes'     },
              { icon: 'fa-bitcoin',     text: 'Bitcoin BTC/USD forecast dashboard'             },
              { icon: 'fa-dollar-sign', text: 'USD/CHF forex analysis'                         },
              { icon: 'fa-comments',    text: 'Minds trader community chat'                    },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: i < 5 ? '1px solid var(--border)' : 'none' }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                  background: 'var(--gold-bg)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: 'var(--gold)', fontSize: 11,
                }}>
                  <i className={`fa-solid ${item.icon}`} />
                </div>
                <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{item.text}</span>
              </div>
            ))}
          </div>

          {/* Account dashboard CTA */}
          <Link
            href="/account"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 9, width: '100%', padding: '14px 0',
              background: 'var(--ink)', color: 'var(--bg)',
              fontWeight: 700, fontSize: 14, borderRadius: 10,
              textDecoration: 'none',
            }}
          >
  
            Go to Account Dashboard
          </Link>
        </div>
      </div>

      <Footer />
    </>
  );
}
