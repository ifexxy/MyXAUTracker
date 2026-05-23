'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { verifyPayment } from '@/lib/api';
import { showToast } from '@/components/Toast';
import Footer from '@/components/Footer';

export default function SubscribePage() {
  const { user, getIdToken } = useAuth();
  const [loading, setLoading] = useState(false);

  const handlePayment = async (amount: number) => {
    if (!user) { showToast('Please sign in first'); return; }
    setLoading(true);
    try {
      const token = await getIdToken();
      if (!token) { showToast('Authentication error'); setLoading(false); return; }

      // Flutterwave payment integration
      const Flutterwave = (window as any).FlutterwaveCheckout;
      if (!Flutterwave) {
        // Load Flutterwave SDK
        await new Promise<void>((resolve) => {
          const script = document.createElement('script');
          script.src = 'https://checkout.flutterwave.com/v3.js';
          script.onload = () => resolve();
          document.body.appendChild(script);
        });
      }

      const txRef = `xau-${Date.now()}-${user.uid}`;

      (window as any).FlutterwaveCheckout({
        public_key: 'FLUTTERWAVE_PUBLIC_KEY',
        tx_ref: txRef,
        amount,
        currency: 'NGN',
        payment_options: 'card,ussd,opay,transfer',
        customer: { email: user.email || '', name: user.email || '' },
        callback: async (response: any) => {
          if (response.status === 'completed') {
            const result = await verifyPayment(response.transaction_id, token);
            if (result.success) {
              showToast('Payment verified! Access granted.');
              setTimeout(() => window.location.reload(), 1500);
            } else {
              showToast('Payment verification failed. Contact support.');
            }
          }
        },
        onclose: () => setLoading(false),
      });
    } catch (e) {
      showToast('Payment failed. Try again.');
      setLoading(false);
    }
  };

  return (
    <>
      <section className="px-[20px] pt-[28px] pb-[18px] text-center">
        <h1 style={{ fontSize: 38, fontWeight: 800, letterSpacing: -1.3, color: 'var(--ink)' }}>
          Subscribe<span style={{ color: 'var(--gold)' }}>.</span>
        </h1>
        <p style={{ maxWidth: 340, margin: '14px auto 0', color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.65 }}>
          Unlock full access to XAU/USD forecasts, signals, and premium features.
        </p>
      </section>

      <div className="mx-[20px] mb-[18px]" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, padding: 18 }}>
        <div className="mb-[16px] text-center">
          <div style={{ fontSize: 10, color: 'var(--ink-4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>Monthly Plan</div>
          <div style={{ fontSize: 42, fontWeight: 800, color: 'var(--ink)' }}>
            ₦9,900<span style={{ fontSize: 16, color: 'var(--ink-3)', fontWeight: 400 }}>/month</span>
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: 'var(--ink-2)' }}>Cancel anytime</div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginBottom: 16 }}>
          {[
            'Real-time XAU/USD price feed',
            'ATR-based price forecasts (1h, 6h, 24h)',
            'Entry signals with confidence levels',
            'Market sentiment analysis',
            'Key support & resistance levels',
            'TradingView advanced chart',
            'Market news feed',
            'Minds community access',
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-[10px] py-[8px]" style={{ borderBottom: i < 7 ? '1px solid var(--border)' : 'none' }}>
              <i className="fa-solid fa-check" style={{ color: 'var(--green)', fontSize: 11, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{f}</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => handlePayment(9900)}
          disabled={loading || !user}
          className="w-full py-[14px] text-[14px] font-bold rounded-[12px] cursor-pointer flex items-center justify-center gap-[8px]"
          style={{ background: 'var(--ink)', color: 'var(--bg)', border: 'none', opacity: loading || !user ? 0.5 : 1 }}
        >
          {loading ? <><i className="fa-solid fa-spinner" style={{ animation: 'spin 0.8s linear infinite' }} /> Processing...</> : <><i className="fa-solid fa-crown" /> Subscribe Now</>}
        </button>

        {!user && (
          <div className="text-center text-[13px] mt-[14px]" style={{ color: 'var(--ink-3)' }}>
            <a href="/signup" style={{ color: 'var(--gold)', fontWeight: 700 }}>Sign up</a> or <a href="/login" style={{ color: 'var(--gold)', fontWeight: 700 }}>sign in</a> to subscribe
          </div>
        )}
      </div>

      <Footer />
    </>
  );
}
