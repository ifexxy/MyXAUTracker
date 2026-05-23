'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getFirebase } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { showToast } from '@/components/Toast';
import Footer from '@/components/Footer';

export default function SubscribePage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [statusHtml, setStatusHtml] = useState('');
  const [payLoading, setPayLoading] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const userTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    (async () => {
      try {
        const fb = getFirebase();
        const snap = await getDoc(doc(fb.db, 'users', user.uid));
        if (!snap.exists()) return;
        const d = snap.data();
        const now = Date.now();
        const trialActive = d.trialEndsAt && new Date(d.trialEndsAt).getTime() > now;
        const subscriptionActive = d.subscriptionStatus === 'active' && d.currentPeriodEnd && new Date(d.currentPeriodEnd).getTime() > now;
        const manualActive = d.manualAccess === true && (!d.manualAccessExpiresAt || new Date(d.manualAccessExpiresAt).getTime() > now);
        if (trialActive || subscriptionActive || manualActive) {
          router.push('/predict');
          return;
        }
        if (d.trialEndsAt && new Date(d.trialEndsAt).getTime() < now) {
          setStatusHtml(`<div class="banner expired" style="background:var(--red-bg);border:1px solid rgba(184,50,50,0.2);color:var(--red);border-radius:10px;padding:14px 16px;display:flex;gap:12px;align-items:flex-start;font-size:13px;line-height:1.6"><i class="fa-solid fa-clock-rotate-left" style="font-size:16px;flex-shrink:0;padding-top:1px"></i><div>Your <strong>7-day free trial has ended.</strong> Subscribe below to continue accessing gold market predictions.</div></div>`);
        }
      } catch (e) {
        console.error('Subscribe page error:', e);
      }
    })();
  }, [user, authLoading, router]);

  const startPayment = async () => {
    if (!user) { showToast('Please wait, loading your account...'); return; }
    setPayLoading(true);
    let userToken;
    try {
      userToken = await user.getIdToken();
      if (!userToken) { showToast('Auth error, please refresh the page'); setPayLoading(false); return; }
    } catch { showToast('Auth error, please refresh the page'); setPayLoading(false); return; }
    (window as any).FlutterwaveCheckout({
      public_key: process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY || '',',
      tx_ref: 'xau-' + Date.now() + '-' + (user?.uid || '').slice(0, 8),
      amount: 9900,
      currency: 'NGN',
      payment_options: 'card,banktransfer,ussd',
      customer: {
        email: user?.email || '',
        name: user?.email || '',
      },
      customizations: {
        title: 'XauTracker',
        description: 'Monthly Forecast Access — ₦9,900',
        logo: 'https://miseducatemen.wordpress.com/wp-content/uploads/2026/05/xautracker-favicon.png',
      },
      callback: async (response: any) => {
        if (response.status === 'successful') {
          showToast('Payment received. Verifying...');
          try {
            const res = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ transaction_id: response.transaction_id, userToken }),
            });
            const data = await res.json();
            if (data.success) {
              showToast('Access granted! Redirecting...');
              setTimeout(() => { router.push('/predict'); }, 1500);
            } else {
              showToast('Verification failed: ' + (data.error || 'Contact support'));
            }
          } catch {
            showToast('Network error during verification');
          }
        } else {
          showToast('Payment was not completed');
        }
        setPayLoading(false);
      },
      onclose: () => { setPayLoading(false); },
    });
  };

  const openMenu = () => { setDrawerOpen(true); setOverlayOpen(true); document.body.style.overflow = 'hidden'; };
  const closeMenu = () => { setDrawerOpen(false); setOverlayOpen(false); document.body.style.overflow = ''; };

  if (authLoading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, color: 'var(--ink-3)' }}>Loading...</div>;

  return (
    <>
      <Script src="https://checkout.flutterwave.com/v3.js" strategy="afterInteractive" />
      <div
        className="overlay"
        onClick={closeMenu}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.42)', zIndex: 200, opacity: overlayOpen ? 1 : 0, pointerEvents: overlayOpen ? 'all' : 'none', transition: 'opacity 0.22s' }}
      />
      <nav
        className="drawer"
        style={{ position: 'fixed', top: 0, left: 0, width: 268, height: '100%', background: 'var(--bg)', zIndex: 201, transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1), background 0.22s', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)' }}
      >
        <div className="drawer-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottom: '1px solid var(--border)' }}>
          <span className="drawer-brand" style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>XauTracker</span>
          <button className="drawer-close" onClick={closeMenu} style={{ background: 'none', border: 'none', cursor: 'pointer', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, color: 'var(--ink-3)', fontSize: 13 }}><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="drawer-nav" style={{ flex: 1, padding: 8, overflowY: 'auto' }}>
          <a className="drawer-item" href="/" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 12px', borderRadius: 7, fontSize: 14, fontWeight: 600, color: 'var(--ink-2)', textDecoration: 'none' }}>Home</a>
          <a className="drawer-item" href="/news" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 12px', borderRadius: 7, fontSize: 14, fontWeight: 600, color: 'var(--ink-2)', textDecoration: 'none' }}>News</a>
          <a className="drawer-item" href="/trends" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 12px', borderRadius: 7, fontSize: 14, fontWeight: 600, color: 'var(--ink-2)', textDecoration: 'none' }}>Trends</a>
          <a className="drawer-item" href="/predict" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 12px', borderRadius: 7, fontSize: 14, fontWeight: 600, color: 'var(--ink-2)', textDecoration: 'none' }}>Forecast</a>
          <div className="drawer-sep" style={{ height: 1, background: 'var(--border)', margin: '6px 8px' }} />
          <a className="drawer-item" href="/about" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 12px', borderRadius: 7, fontSize: 14, fontWeight: 600, color: 'var(--ink-2)', textDecoration: 'none' }}>About</a>
          <a className="drawer-item" href="/disclaimer" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 12px', borderRadius: 7, fontSize: 14, fontWeight: 600, color: 'var(--ink-2)', textDecoration: 'none' }}>Disclaimer</a>
          <a className="drawer-item" href="/contact" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 12px', borderRadius: 7, fontSize: 14, fontWeight: 600, color: 'var(--ink-2)', textDecoration: 'none' }}>Contact</a>
        </div>
        <div className="drawer-footer" style={{ padding: '12px 12px 16px', borderTop: '1px solid var(--border)' }}>
          <div className="theme-row" onClick={toggleTheme} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 8, background: 'var(--bg-2)', cursor: 'pointer', userSelect: 'none' }}>
            <div className="theme-row-label" style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>
              <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`} style={{ fontSize: 13, color: 'var(--ink-3)', width: 16, textAlign: 'center' }} />
              <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            </div>
            <div className="sw" style={{ width: 38, height: 22, background: theme === 'dark' ? 'var(--ink)' : 'var(--border)', borderRadius: 11, position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
              <div className="sw-knob" style={{ position: 'absolute', top: 3, left: 3, width: 16, height: 16, borderRadius: '50%', background: 'var(--bg)', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'transform 0.2s', transform: theme === 'dark' ? 'translateX(16px)' : 'translateX(0)' }} />
            </div>
          </div>
        </div>
      </nav>

     

      <div style={{ flex: 1, padding: '28px 20px 0' }}>
        <div className="page-eyebrow" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold)', background: 'var(--gold-bg)', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, marginBottom: 14, transition: 'background 0.22s, color 0.22s' }}>
          <i className="fa-solid fa-crown" /> XauTracker Pro
        </div>
        <h1 className="page-title" style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.25, marginBottom: 8, letterSpacing: -0.3, transition: 'color 0.22s' }}>
          Unlock Gold<br />Real-Time Forecast
        </h1>
        <p className="page-sub" style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.65, marginBottom: 24, transition: 'color 0.22s' }}>
          ATR-based price forecasts, key levels, gold signals and sentiment — updated live every minute.
        </p>

        <div id="status-banner" style={{ marginBottom: 18 }} dangerouslySetInnerHTML={{ __html: statusHtml }} />

        <div className="plan-card featured" style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 20, background: 'var(--bg-2)', marginBottom: 14, transition: 'background 0.22s, border-color 0.22s', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, var(--gold), transparent)' }} />
          <div className="plan-label" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 12, transition: 'color 0.22s' }}>Monthly Plan</div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink-3)', transition: 'color 0.22s' }}>$</span>
            <span style={{ fontSize: 38, fontWeight: 700, color: 'var(--ink)', lineHeight: 1, letterSpacing: -1, fontVariantNumeric: 'tabular-nums', transition: 'color 0.22s' }}>7.5</span>
            <span style={{ fontSize: 13, color: 'var(--ink-3)', transition: 'color 0.22s' }}>/mo</span>
          </div>
          <div className="plan-cycle" style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 18, transition: 'color 0.22s' }}>or ₦9,900/mo for Nigeria · Billed monthly · Cancel anytime</div>

          <ul className="plan-features" style={{ listStyle: 'none', padding: 0, margin: '0 0 20px', borderTop: '1px solid var(--border)', transition: 'border-color 0.22s' }}>
            {[
              'Real-time XAU/USD price forecasts',
              '1h, 6h & 24h prediction timeline',
              'Trade entry signals (1h, 4h, 24h)',
              'ATR-based volatility model',
              'Key support & resistance levels',
              'Market sentiment & buy/sell signals',
              'Market session awareness',
            ].map((f, i, arr) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: 'var(--ink-2)', padding: '10px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none', lineHeight: 1.5, transition: 'color 0.22s, border-color 0.22s' }}>
                <i className="fa-solid fa-check" style={{ color: 'var(--green)', fontSize: 11, flexShrink: 0, marginTop: 2 }} />
                {f}
              </li>
            ))}
          </ul>

          <button className="btn-primary" id="pay-btn" onClick={startPayment} disabled={payLoading}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: 15, background: 'var(--ink)', color: 'var(--bg)', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 14, fontWeight: 700, borderRadius: 8, border: 'none', cursor: payLoading ? 'not-allowed' : 'pointer', transition: 'opacity 0.16s, background 0.22s, color 0.22s', marginBottom: 10, opacity: payLoading ? 0.45 : 1 }}>
            {payLoading ? <><i className="fa-solid fa-spinner" style={{ animation: 'spin 0.8s linear infinite' }} /> Processing...</> : <><i className="fa-solid fa-lock-open" /> Subscribe — ₦9,900/month</>}
          </button>
          <button className="btn-outline" onClick={signOut}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: 13, background: 'transparent', color: 'var(--ink-3)', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 13, fontWeight: 600, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.16s', textDecoration: 'none' }}>
            <i className="fa-solid fa-right-from-bracket" /> Sign Out
          </button>
          <div className="secure-note" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 11, color: 'var(--ink-4)', marginTop: 12, textAlign: 'center', transition: 'color 0.22s' }}>
            <i className="fa-solid fa-shield-halved" style={{ color: 'var(--green)' }} />
            Secured by Flutterwave · Payments are encrypted
          </div>
        </div>

        <div className="transfer-card" style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 20, background: 'var(--bg-2)', marginBottom: 14, transition: 'background 0.22s, border-color 0.22s' }}>
          <div className="transfer-label" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 14, transition: 'color 0.22s' }}>Pay with Bank Transfer</div>

          <div className="transfer-step" style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)', alignItems: 'flex-start', transition: 'border-color 0.22s' }}>
            <div className="transfer-num" style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', width: 20, flexShrink: 0, paddingTop: 1, transition: 'color 0.22s' }}>01</div>
            <div className="transfer-text" style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55, transition: 'color 0.22s' }}>
              Transfer <strong style={{ color: 'var(--ink)' }}>₦9,900</strong> to <strong style={{ color: 'var(--ink)' }}>OPAY</strong> account number <strong style={{ color: 'var(--ink)' }}>6518823532</strong>
            </div>
          </div>
          <div className="transfer-step" style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)', alignItems: 'flex-start', transition: 'border-color 0.22s' }}>
            <div className="transfer-num" style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', width: 20, flexShrink: 0, paddingTop: 1, transition: 'color 0.22s' }}>02</div>
            <div className="transfer-text" style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55, transition: 'color 0.22s' }}>
              Include your <strong style={{ color: 'var(--ink)' }}>XauTracker email address</strong> in the payment narrative / description
            </div>
          </div>
          <div className="transfer-step" style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)', alignItems: 'flex-start', transition: 'border-color 0.22s' }}>
            <div className="transfer-num" style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', width: 20, flexShrink: 0, paddingTop: 1, transition: 'color 0.22s' }}>03</div>
            <div className="transfer-text" style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55, transition: 'color 0.22s' }}>
              After a successful transfer, your account will be activated within a few hours
            </div>
          </div>
          <div className="transfer-step" style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: 'none', alignItems: 'flex-start', transition: 'border-color 0.22s' }}>
            <div className="transfer-num" style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', width: 20, flexShrink: 0, paddingTop: 1, transition: 'color 0.22s' }}>04</div>
            <div className="transfer-text" style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55, transition: 'color 0.22s' }}>
              Got questions about account activation?{' '}
              <a href="https://wa.link/pvhzgb" target="_blank" rel="noopener" style={{ color: 'var(--green)', textDecoration: 'none', fontWeight: 600 }}>Send a WhatsApp message</a>
            </div>
          </div>
        </div>
      </div>

      <Footer />

      {/* Toast */}
      <div id="toast" style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%) translateY(20px)', background: 'var(--ink)', color: 'var(--bg)', padding: '10px 18px', borderRadius: 20, fontSize: 12, fontWeight: 600, opacity: 0, transition: 'all 0.28s', pointerEvents: 'none', zIndex: 300, whiteSpace: 'nowrap' }} />
    </>
  );
}
