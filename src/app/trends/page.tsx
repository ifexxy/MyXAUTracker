'use client';

import { useState, useEffect, useRef } from 'react';
import { useGoldPrice } from '@/contexts/GoldPriceContext';
import { fmtPrice } from '@/lib/api';
import Script from 'next/script';
import Footer from '@/components/Footer';

export default function TrendsPage() {
  const { price } = useGoldPrice();
  const { theme } = { theme: 'light' };
  const [period, setPeriod] = useState('1D');
  const tvRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tvRef.current) return;
    const intervalMap: Record<string, string> = { '1D': '1', '5D': '5', '1M': '1M', '3M': '3M', '1Y': '1Y' };
    const intMap: Record<string, string> = { '1D': '60', '5D': '60', '1M': '240', '3M': '1D', '1Y': '1W' };
    tvRef.current.innerHTML = '';
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true, symbol: 'OANDA:XAUUSD',
      interval: intMap[period] || '60',
      timezone: 'Etc/UTC',
      theme: 'light',
      style: '1', locale: 'en',
      range: period === '1D' ? '1d' : period === '5D' ? '5d' : period === '1M' ? '1m' : period === '3M' ? '3m' : '12m',
      allow_symbol_change: true,
      save_image: false,
      hide_volume: false,
      support_host: 'https://www.tradingview.com',
    });
    tvRef.current.appendChild(script);
  }, [period, theme]);

  return (
    <>
      <section className="px-[20px] pt-[28px] pb-[18px] text-center">
        <h1 style={{ fontSize: 38, fontWeight: 800, letterSpacing: -1.3, color: 'var(--ink)' }}>
          Trends<span style={{ color: 'var(--gold)' }}>.</span>
        </h1>
        <p style={{ maxWidth: 340, margin: '14px auto 0', color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.65 }}>
          XAU/USD historical trends and chart analysis.
        </p>
      </section>

      <div className="mx-[20px] mb-[14px]">
        <div className="flex gap-[6px] items-center justify-between mb-[12px]">
          <div className="flex gap-[4px]">
            {['1D', '5D', '1M', '3M', '1Y'].map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                style={{
                  padding: '4px 9px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
                  border: period === p ? 'none' : '1px solid var(--border)',
                  background: period === p ? 'var(--ink)' : 'transparent',
                  color: period === p ? 'var(--bg)' : 'var(--ink-2)',
                }}>
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ margin: '0 20px 14px', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', height: 450 }} ref={tvRef} />

      {price && (
        <div className="mx-[20px] mb-[14px]">
          <div className="grid grid-cols-2 gap-[10px]">
            {[
              { label: 'Current Price', value: fmtPrice(price.price) },
              { label: 'Daily High', value: fmtPrice(price.high || 0) },
              { label: 'Daily Low', value: fmtPrice(price.low || 0) },
              { label: 'Change', value: `${price.ch >= 0 ? '+' : ''}${price.ch?.toFixed(2) || '—'}%` },
            ].map((s, i) => (
              <div key={i} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, padding: 14 }}>
                <div style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Footer />
    </>
  );
}
