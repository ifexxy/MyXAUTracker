'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import Footer from '@/components/Footer';

export default function HomePage() {
  const { user, loading, signOut } = useAuth();
  const [authInner, setAuthInner] = useState<React.ReactNode>(null);

  useEffect(() => {
    if (loading) {
      setAuthInner(<div className="auth-skel" style={{ height: 46, borderRadius: 8, background: 'linear-gradient(90deg, var(--bg-3) 25%, var(--bg-2) 50%, var(--bg-3) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />);
    } else if (user) {
      setAuthInner(
        <>
          <div className="flex items-center gap-[10px] p-[10px_12px] mb-[12px] rounded-[8px]" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
            <div className="w-[32px] h-[32px] rounded-full flex items-center justify-center text-[13px]" style={{ background: 'var(--bg-3)', color: 'var(--ink-3)', flexShrink: 0 }}>
              <i className="fa-solid fa-user" />
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase" style={{ letterSpacing: '0.1em', color: 'var(--green)', marginBottom: 2 }}>Signed In</div>
              <div className="text-[12px] font-semibold" style={{ color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 185 }}>{user.email}</div>
            </div>
          </div>
          <Link href="/predict" className="flex items-center justify-center gap-[8px] w-full py-[14px] text-[14px] font-bold rounded-[8px] no-underline mb-[8px]" style={{ background: 'var(--ink)', color: 'var(--bg)' }}>
            Open Gold Forecast
          </Link>
          <button onClick={signOut} className="flex items-center justify-center gap-[8px] w-full py-[12px] text-[13px] font-semibold rounded-[10px] cursor-pointer" style={{ background: 'transparent', color: 'var(--ink-3)', border: '1px solid var(--border)' }}>
            <i className="fa-solid fa-right-from-bracket" /> Sign Out
          </button>
        </>
      );
    } else {
      setAuthInner(
        <>
          <div className="inline-flex items-center gap-[5px] text-[10px] font-bold px-[9px] py-[4px] rounded-full mb-[10px]" style={{ color: 'var(--green)', background: 'var(--green-bg)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            7-Day Free Trial · No Payment Required
          </div>
          <p className="text-[13px] mb-[14px]" style={{ color: 'var(--ink-2)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--ink)' }}>Two steps</strong> to get started, just email and password. Full forecast dashboard free for 7 days.
          </p>
          <Link href="/signup" className="flex items-center justify-center gap-[8px] w-full py-[14px] text-[14px] font-bold rounded-[8px] no-underline mb-[8px]" style={{ background: 'var(--ink)', color: 'var(--bg)' }}>
            <i className="fa-solid fa-rocket" style={{ fontSize: 12 }} /> Create Free Account
          </Link>
          <Link href="/login" className="flex items-center justify-center w-full py-[13px] text-[14px] font-semibold rounded-[8px] no-underline" style={{ background: 'transparent', color: 'var(--ink-2)', border: '1px solid var(--border)' }}>
            Sign In
          </Link>
        </>
      );
    }
  }, [user, loading, signOut]);

  return (
    <>
      {/* Feature cards */}
{/* ── HERO ── */}
<section style={{ padding: '52px 20px 0', textAlign: 'center' }}>

  {/* Badge */}
  <div className="inline-flex items-center gap-[6px] text-[10px] font-bold px-[10px] py-[5px] rounded-full mb-[20px]"
       style={{ color: 'var(--green)', background: 'var(--green-bg)', letterSpacing: '0.08em', textTransform: 'uppercase', border: '1px solid var(--green)' }}>
    <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--green)', display: 'inline-block', animation: 'pulse 1.5s ease-in-out infinite' }} />
    Live · XAU/USD
  </div>

  {/* H1 */}
  <h1 style={{ fontSize: 36, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.18, letterSpacing: -1, marginBottom: 14 }}>
    Gold Forecasts.<br />
    <span style={{ color: 'var(--ink-3)' }}>Built on Real Math.</span>
  </h1>

  {/* Sub */}
  <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.65, maxWidth: 300, margin: '0 auto 26px' }}>
    ATR-based price signals across 5m–24h timeframes, live market news, and technical analysis for XAU/USD.
  </p>

  {/* CTA */}
  <Link href={user ? '/predict' : '/signup'}
        className="inline-flex items-center justify-center gap-[8px] px-[28px] py-[15px] text-[14px] font-bold rounded-[8px] no-underline mb-[10px]"
        style={{ background: 'var(--ink)', color: 'var(--bg)', width: '100%', maxWidth: 340 }}>
    <i className="fa-solid fa-brain" style={{ fontSize: 12 }} />
    {user ? 'Open Gold Forecast' : 'Start Free — 7 Days'}
  </Link>

  {/* Secondary */}
  {!user && (
    <div style={{ marginBottom: 36 }}>
      <Link href="/login" style={{ fontSize: 12, color: 'var(--ink-4)', textDecoration: 'none' }}>
        Already have an account? <span style={{ color: 'var(--ink-3)', borderBottom: '1px solid var(--border)' }}>Sign in</span>
      </Link>
    </div>
  )}

  {/* Marquee */}
  <div style={{ overflow: 'hidden', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '12px 0', marginLeft: -20, marginRight: -20, marginTop: user ? 36 : 0 }}>
    <div style={{
      display: 'flex',
      gap: 0,
      animation: 'marquee 22s linear infinite',
      width: 'max-content',
    }}>
      {[
        'ATR Volatility Model', 'Live XAU/USD Price', 'RSI · MA20 · MA50',
        'Multi-Timeframe Forecast', 'Market Session Awareness', 'London · NY · Asian Sessions',
        'Pivot Levels', 'Bull/Bear Signals', 'Live Gold News', 'TwelveData API',
        'ATR Volatility Model', 'Live XAU/USD Price', 'RSI · MA20 · MA50',
        'Multi-Timeframe Forecast', 'Market Session Awareness', 'London · NY · Asian Sessions',
        'Pivot Levels', 'Bull/Bear Signals', 'Live Gold News', 'TwelveData API',
      ].map((item, i) => (
        <span key={i} style={{ fontSize: 11, color: 'var(--ink-4)', whiteSpace: 'nowrap', padding: '0 20px', borderRight: '1px solid var(--border)' }}>
          {item}
        </span>
      ))}
    </div>
  </div>
</section>

<style>{`
  @keyframes marquee {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
  }
`}</style>
      <div className="flex gap-[10px] overflow-x-auto px-0 py-[20px_0_20px_20px]" style={{ borderBottom: '1px solid var(--border)', WebkitOverflowScrolling: 'touch' }}>
        {[
          { name: 'Numbers Don\'t Lie', desc: 'We used ATR model to forecast across 1hr, 4hr and 24h timeframe.' },
          { name: 'Trend Analysis', desc: 'MA20, MA50, RSI(14) and multi-timeframe technical charts.' },
          { name: 'Market News', desc: 'Live gold market headlines from major financial outlets.' },
          { name: 'Real-Time', desc: 'Prices refreshed every 10 seconds via TwelveData API.' },
        ].map((f, i) => (
          <div key={i} className="flex-shrink-0 w-[176px] rounded-[10px] px-[14px] py-[15px]" style={{ background: 'var(--bg-2)' }}>
            <div className="text-[15px] mb-[10px]" style={{ color: 'var(--ink-3)' }}></div>
            <div className="text-[13px] font-bold mb-[4px]" style={{ color: 'var(--ink)' }}>{f.name}</div>
            <div className="text-[11px]" style={{ color: 'var(--ink-3)', lineHeight: 1.55 }}>{f.desc}</div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <section style={{ padding: '26px 20px', borderBottom: '1px solid var(--border)' }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.25, letterSpacing: -0.4, marginBottom: 8 }}>
          Trade Gold/Bitcoin<br />like a Pro.
        </h1>
        <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.65, marginBottom: 20 }}>
          Whether you&apos;re a pro trader or a newbie, we have the right tools to supercharge your trading experience. Join traders who rely on XauTracker every day to make profit with minimal loss.
        </p>

        <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 16, background: 'var(--bg-2)', marginBottom: 14 }}>
          {authInner}
        </div>

        <div className="grid grid-cols-2 gap-[8px]">
          <a href="https://wa.me/2348131560586" target="_blank" rel="noopener" className="flex items-center justify-center gap-[7px] py-[12px] text-[12px] font-bold rounded-[8px] no-underline" style={{ background: '#25D366', color: '#000' }}>
            <i className="fa-brands fa-whatsapp" /> WhatsApp
          </a>
          <Link href="/contact" className="flex items-center justify-center gap-[7px] py-[12px] text-[12px] font-semibold rounded-[8px] no-underline" style={{ background: 'transparent', color: 'var(--ink-2)', border: '1px solid var(--border)' }}>
            <i className="fa-solid fa-envelope" /> Email Us
          </Link>
        </div>
      </section>

      {/* How it Works */}
      <section style={{ padding: '26px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 18 }}>
          How it Works
        </div>
        {[
          { num: '01', title: 'Live Price Feed', body: 'Real-time XAU/USD spot prices from TwelveData, refreshed every 60 seconds.' },
          { num: '02', title: 'ATR Volatility Model', body: 'Uses <code>ATR × √(t/1440)</code> — the square-root-of-time formula — for realistic price bands.' },
          { num: '03', title: 'Session Awareness', body: 'Adjusts for Asian, London and New York sessions. Peak overlap gets a higher volatility multiplier.' },
          { num: '04', title: 'Momentum & Reversion', body: 'Drift weighted by today\'s momentum and dampened by mean-reversion pressure.' },
        ].map((s, i) => (
          <div key={i} className="flex gap-[14px] py-[13px]" style={{ borderBottom: i < 3 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', width: 22, flexShrink: 0, paddingTop: 1 }}>{s.num}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 3 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: s.body }} />
            </div>
          </div>
        ))}
      </section>

      <Footer />
    </>
  );
}
