'use client';

import Footer from '@/components/Footer';

export default function AboutPage() {
  return (
    <>
      <section className="px-[20px] pt-[28px] pb-[18px] text-center">
        <h1 style={{ fontSize: 38, fontWeight: 800, letterSpacing: -1.3, color: 'var(--ink)' }}>
          About<span style={{ color: 'var(--gold)' }}>.</span>
        </h1>
        <p style={{ maxWidth: 340, margin: '14px auto 0', color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.65 }}>
          What XauTracker is built for.
        </p>
      </section>

      <div className="mx-[20px] mb-[18px]" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', marginBottom: 12 }}>What is XauTracker?</h2>
        <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.75 }}>
          <p style={{ marginBottom: 14 }}>
            XauTracker is a financial technology platform that delivers real-time XAU/USD (gold) spot prices and algorithmic price forecasts. 
            Our models use the Average True Range (ATR) volatility method combined with session-aware multipliers and momentum analysis.
          </p>
          <p style={{ marginBottom: 14 }}>
            We serve traders and investors who want data-driven insights into gold price movements. Our platform is built for both 
            experienced traders and newcomers looking to understand market dynamics.
          </p>
          <p>
            Built with accuracy and transparency in mind, every forecast clearly shows its confidence level and methodology.
          </p>
        </div>
      </div>

      <div className="mx-[20px] mb-[18px]" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', marginBottom: 12 }}>Our Approach</h2>
        <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.75 }}>
          <p style={{ marginBottom: 14 }}>
            <strong style={{ color: 'var(--ink)' }}>ATR × √(t/1440)</strong> — The square-root-of-time formula scales volatility 
            proportionally to the square root of the forecast horizon.
          </p>
          <p style={{ marginBottom: 14 }}>
            <strong style={{ color: 'var(--ink)' }}>Session Awareness</strong> — We adjust volatility multipliers based on market session 
            (Asian, London, New York) and their overlaps.
          </p>
          <p>
            <strong style={{ color: 'var(--ink)' }}>Momentum & Reversion</strong> — Our models balance short-term momentum with 
            mean-reversion tendencies to avoid over-extension.
          </p>
        </div>
      </div>

      <Footer />
    </>
  );
}
