'use client';

import { useState } from 'react';
import Script from 'next/script';
import { useAuth } from '@/contexts/AuthContext';
import type { UserData } from '@/types';

/* Charged in NGN, same rate the app already uses ($10 = ₦15,000).
   Keep in sync with TRIAL_PRICE_NGN in api/_trial.js. */
export const TRIAL_PRICE_NGN = 1500;

/* True for accounts that were offered a trial and haven't started one. */
export function canStartTrial(d?: UserData | null): boolean {
  if (!d) return false;
  if (d.banned === true) return false;
  return d.trialOffer === true && !d.trialEndsAt;
}

export default function StartTrialCard({ onActivated }: { onActivated?: () => void | Promise<void> }) {
  const { user, getIdToken } = useAuth();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const start = async () => {
    if (!user || busy) return;
    setMsg(null);

    const checkout = (window as any).FlutterwaveCheckout;
    if (!checkout) { setMsg({ ok: false, text: 'Payment is still loading. Try again in a moment.' }); return; }

    setBusy(true);
    const userToken = await getIdToken();
    if (!userToken) { setBusy(false); setMsg({ ok: false, text: 'Please refresh the page and try again.' }); return; }

    checkout({
      public_key: process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY || '',
      // the uid inside tx_ref ties this payment to this account (checked on the server)
      tx_ref: `xautrial-${user.uid}-${Date.now()}`,
      amount: TRIAL_PRICE_NGN,
      currency: 'NGN',
      payment_options: 'card,banktransfer,ussd',
      customer: { email: user.email || '', name: user.email || '' },
      customizations: {
        title: 'XauTracker',
        description: '3-Day Trial — one-time ₦1,500 (about $1)',
        logo: 'https://miseducatemen.wordpress.com/wp-content/uploads/2026/05/xautracker-favicon.png',
      },
      callback: async (response: any) => {
        if (response.status !== 'successful') {
          setMsg({ ok: false, text: 'Payment was not completed.' });
          setBusy(false);
          return;
        }
        setMsg({ ok: true, text: 'Payment received. Starting your trial…' });
        try {
          const res = await fetch('/api/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transaction_id: response.transaction_id, userToken, type: 'trial' }),
          });
          const data = await res.json();
          if (data.success) {
            setMsg({ ok: true, text: 'Your 3-day trial has started!' });
            await onActivated?.();
          } else {
            setMsg({ ok: false, text: 'Verification failed: ' + (data.error || 'contact support') + '. If you were charged, your trial will start automatically within a few minutes.' });
          }
        } catch {
          setMsg({ ok: false, text: 'Network error while verifying. If you were charged, your trial will start automatically within a few minutes.' });
        }
        setBusy(false);
      },
      onclose: () => { setBusy(false); },
    });
  };

  return (
    <div style={{ position: 'relative', overflow: 'hidden', background: 'var(--bg-2)', border: '1px solid var(--gold)', borderRadius: 14, padding: '18px 16px' }}>
      {/* same script the subscribe page uses; Next loads it once */}
      <Script src="https://checkout.flutterwave.com/v3.js" strategy="afterInteractive" />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, var(--gold), transparent)' }} />

      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', background: 'var(--gold-bg)', padding: '4px 10px', borderRadius: 20, marginBottom: 10 }}>
        <i className="fa-solid fa-gift" /> Trial available
      </div>

      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', letterSpacing: -0.3, marginBottom: 6 }}>
        Start your 3-day trial for <span style={{ color: 'var(--gold)' }}>$1</span>
      </div>
      <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 14 }}>
        A one-time payment of <strong style={{ color: 'var(--ink)' }}>₦1,500 (about $1)</strong> unlocks full access to the gold and Bitcoin forecasts, signals and the Minds community for 3 days. It keeps trials for real traders and stops repeat accounts.
      </p>

      <button
        onClick={start}
        disabled={busy || !user}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%',
          padding: 14, background: 'var(--ink)', color: 'var(--bg)', fontSize: 14, fontWeight: 700,
          borderRadius: 10, border: 'none', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.5 : 1,
        }}
      >
        {busy
          ? <><i className="fa-solid fa-spinner" style={{ animation: 'spin 0.8s linear infinite' }} /> Processing…</>
          : <><i className="fa-solid fa-lock-open" /> Start 3-day trial for only $1</>}
      </button>

      {msg && (
        <div style={{
          marginTop: 10, fontSize: 12, lineHeight: 1.55, padding: '10px 12px', borderRadius: 10,
          color: msg.ok ? 'var(--green)' : 'var(--red)',
          background: msg.ok ? 'var(--green-bg)' : 'var(--red-bg)',
        }}>{msg.text}</div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 11, color: 'var(--ink-4)', marginTop: 12, textAlign: 'center', lineHeight: 1.5 }}>
        <i className="fa-solid fa-shield-halved" style={{ color: 'var(--green)' }} />
        Secured by Flutterwave · non-refundable · one trial per account 
      </div>
    </div>
  );
}
