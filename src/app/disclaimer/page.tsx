'use client';

import Footer from '@/components/Footer';

export default function DisclaimerPage() {
  return (
    <>
      <section className="px-[20px] pt-[28px] pb-[18px] text-center">
        <h1 style={{ fontSize: 38, fontWeight: 800, letterSpacing: -1.3, color: 'var(--ink)' }}>
          Disclaimer<span style={{ color: 'var(--gold)' }}>.</span>
        </h1>
        <p style={{ maxWidth: 340, margin: '14px auto 0', color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.65 }}>
          Important information about using XauTracker.
        </p>
      </section>

      <div className="mx-[20px] mb-[18px]" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
        <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.75 }}>
          <p style={{ marginBottom: 14 }}>
            <strong style={{ color: 'var(--red)' }}>Not Financial Advice:</strong> The predictions, forecasts, and market signals provided by XauTracker are algorithmic estimates based on statistical volatility modelling. They are not financial advice and should not be treated as such.
          </p>
          <p style={{ marginBottom: 14 }}>
            <strong style={{ color: 'var(--red)' }}>Trading Risk:</strong> Trading gold (XAU/USD) and other financial instruments carries significant risk. You could lose all or part of your invested capital. Past performance does not guarantee future results.
          </p>
          <p style={{ marginBottom: 14 }}>
            <strong style={{ color: 'var(--red)' }}>No Guarantee:</strong> XauTracker makes no guarantees about the accuracy, reliability, or completeness of any forecast or market data provided on this platform.
          </p>
          <p style={{ marginBottom: 14 }}>
            <strong style={{ color: 'var(--red)' }}>Professional Advice:</strong> Always consult a licensed financial professional before making any trading or investment decisions.
          </p>
          <p>
            <strong style={{ color: 'var(--red)' }}>Data Sources:</strong> Gold price data is sourced from third-party APIs including Metals.Dev, Twelve Data, and Yahoo Finance. We are not responsible for delays, inaccuracies, or interruptions in third-party data.
          </p>
        </div>
      </div>

      <Footer />
    </>
  );
}
